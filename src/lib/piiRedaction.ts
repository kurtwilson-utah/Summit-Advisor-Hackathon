import type { RedactionBundle, RedactionEntity, RedactionEntityType } from "./types";

interface Span {
  start: number;
  end: number;
  type: RedactionEntityType;
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4})(?:\s?(?:x|ext\.?)\s?\d+)?/gi;
const ADDRESS_PATTERN =
  /\b\d{1,6}\s+(?:[A-Z0-9][A-Z0-9.'-]*\s){0,5}(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Parkway|Pkwy|Suite|Ste|Unit|Floor|Fl)\b(?:[^\n,.;]*)/gi;
const INLINE_NAME_PATTERN =
  /\b(?:my name is|i am|i'm|this is|signed,|thanks,|regards,)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/gi;

function collectMatches(pattern: RegExp, text: string, type: RedactionEntityType, group = 0): Span[] {
  const spans: Span[] = [];
  pattern.lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const value = match[group];
    if (!value) {
      continue;
    }

    const source = match[0];
    const startOffset = source.indexOf(value);
    const matchStart = (match.index ?? 0) + Math.max(startOffset, 0);

    spans.push({
      start: matchStart,
      end: matchStart + value.length,
      type
    });
  }

  return spans;
}

function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    return right.end - left.end;
  });

  const merged: Span[] = [];

  for (const span of sorted) {
    const previous = merged[merged.length - 1];

    if (!previous || span.start >= previous.end) {
      merged.push(span);
      continue;
    }

    if (span.end > previous.end) {
      previous.end = span.end;
    }
  }

  return merged;
}

function detectSpans(text: string): Span[] {
  return mergeSpans([
    ...collectMatches(EMAIL_PATTERN, text, "email"),
    ...collectMatches(PHONE_PATTERN, text, "phone"),
    ...collectMatches(ADDRESS_PATTERN, text, "address"),
    ...collectMatches(INLINE_NAME_PATTERN, text, "name", 1)
  ]);
}

export function redactText(text: string): RedactionBundle {
  const spans = detectSpans(text);

  if (!spans.length) {
    return {
      redactedText: text,
      entities: []
    };
  }

  const entities: RedactionEntity[] = spans.map((span, index) => {
    const ordinal = String(index + 1).padStart(2, "0");

    return {
      id: crypto.randomUUID(),
      type: span.type,
      placeholder: `[[PII_${span.type.toUpperCase()}_${ordinal}]]`,
      original: text.slice(span.start, span.end),
      start: span.start,
      end: span.end
    };
  });

  let redactedText = text;

  for (const entity of [...entities].sort((left, right) => right.start - left.start)) {
    redactedText =
      redactedText.slice(0, entity.start) + entity.placeholder + redactedText.slice(entity.end);
  }

  return {
    redactedText,
    entities
  };
}

export function restoreText(redactedText: string, bundle?: RedactionBundle): string {
  if (!bundle?.entities.length) {
    return redactedText;
  }

  return bundle.entities.reduce((value, entity) => {
    return value.split(entity.placeholder).join(entity.original);
  }, redactedText);
}
