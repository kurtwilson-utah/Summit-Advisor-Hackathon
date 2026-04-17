import type { RetrievedKnowledgeSource } from "../../../shared/chat.js";
import type {
  KnowledgeRetrievalAdapter,
  RetrievedChunkCandidate
} from "../../providers/rag/supabaseKnowledgeRetrievalAdapter.js";

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "with"
]);

export interface KnowledgeRetrievalResult {
  sources: RetrievedKnowledgeSource[];
  warnings: string[];
}

export interface KnowledgeRetrievalService {
  retrieveRelevantKnowledge(args: { query: string; limit?: number }): Promise<KnowledgeRetrievalResult>;
}

export function createKnowledgeRetrievalService(dependencies: {
  adapter: KnowledgeRetrievalAdapter;
}): KnowledgeRetrievalService {
  return {
    async retrieveRelevantKnowledge({ query, limit = 5 }) {
      const warnings: string[] = [];
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        return { sources: [], warnings };
      }

      const allChunks = await dependencies.adapter.loadReadyChunks();
      const scoredChunks = allChunks
        .map((chunk) => ({
          chunk,
          score: scoreChunk(chunk, normalizedQuery)
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);

      if (scoredChunks.length === 0) {
        warnings.push("No relevant Summit knowledge documents matched this turn.");
        return { sources: [], warnings };
      }

      if (scoredChunks.every((candidate) => candidate.chunk.sourceTier === "fallback")) {
        warnings.push("Only fallback knowledge sources were relevant for this turn.");
      }

      return {
        sources: scoredChunks.map(({ chunk, score }) => ({
          documentId: chunk.documentId,
          title: chunk.title,
          sourceType: chunk.sourceType,
          storagePath: chunk.storagePath,
          excerpt: toExcerpt(chunk.content),
          sourceTier: chunk.sourceTier,
          isStubCandidate: chunk.isStubCandidate,
          score
        })),
        warnings
      };
    }
  };
}

function scoreChunk(chunk: RetrievedChunkCandidate, query: string): number {
  const queryTokens = tokenize(query);
  const haystack = `${chunk.title} ${chunk.sourceType} ${chunk.content}`.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    const occurrences = countOccurrences(haystack, token);

    if (occurrences === 0) {
      continue;
    }

    const inTitle = countOccurrences(chunk.title.toLowerCase(), token);
    const inSourceType = countOccurrences(chunk.sourceType.toLowerCase(), token);

    score += occurrences * 6;
    score += inTitle * 16;
    score += inSourceType * 8;
  }

  const normalizedQuery = query.toLowerCase();

  if (normalizedQuery.length >= 10 && haystack.includes(normalizedQuery)) {
    score += 18;
  }

  score += chunk.sourceTier === "preferred" ? 14 : -12;
  score += chunk.sourcePriority / 10;

  if (chunk.isStubCandidate) {
    score -= 35;
  }

  return score;
}

function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !stopWords.has(token))
    )
  );
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let startIndex = 0;

  while (startIndex >= 0) {
    startIndex = haystack.indexOf(needle, startIndex);

    if (startIndex >= 0) {
      count += 1;
      startIndex += needle.length;
    }
  }

  return count;
}

function toExcerpt(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 320) {
    return normalized;
  }

  return `${normalized.slice(0, 317)}...`;
}
