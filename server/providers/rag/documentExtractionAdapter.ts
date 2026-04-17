import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

export interface ExtractionResult {
  text: string;
  metadata: {
    isStubCandidate: boolean;
    sourcePriority: number;
    sourceTier: "preferred" | "fallback";
    stubSignals: string[];
    warnings: string[];
    wordCount: number;
  };
}

export interface DocumentExtractionAdapter {
  extract(args: { fileName: string; storagePath: string; buffer: Buffer }): Promise<ExtractionResult | null>;
}

export function createDocumentExtractionAdapter(): DocumentExtractionAdapter {
  return {
    async extract({ fileName, storagePath, buffer }) {
      const extension = getExtension(fileName);

      if (extension === "docx") {
        const result = await mammoth.extractRawText({ buffer });
        const text = normalizeText(result.value);
        const warnings = [...result.messages.map((message) => message.message)];

        return {
          text,
          metadata: buildExtractionMetadata({ storagePath, text, warnings })
        };
      }

      if (extension === "csv") {
        const text = normalizeText(buffer.toString("utf8"));

        return {
          text,
          metadata: buildExtractionMetadata({ storagePath, text, warnings: [] })
        };
      }

      if (extension === "xlsx" || extension === "xls") {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const text = normalizeText(
          workbook.SheetNames.map((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();

            return csv ? `Sheet: ${sheetName}\n${csv}` : `Sheet: ${sheetName}`;
          }).join("\n\n")
        );

        return {
          text,
          metadata: buildExtractionMetadata({ storagePath, text, warnings: [] })
        };
      }

      if (extension === "pdf") {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const text = normalizeText(result.text);
        await parser.destroy();

        return {
          text,
          metadata: buildExtractionMetadata({ storagePath, text, warnings: [] })
        };
      }

      if (extension === "txt" || extension === "md") {
        const text = normalizeText(buffer.toString("utf8"));

        return {
          text,
          metadata: buildExtractionMetadata({ storagePath, text, warnings: [] })
        };
      }

      return null;
    }
  };
}

function buildExtractionMetadata(args: {
  storagePath: string;
  text: string;
  warnings: string[];
}): ExtractionResult["metadata"] {
  const wordCount = args.text.split(/\s+/).filter(Boolean).length;
  const stubSignals = [
    ...(wordCount < 140 ? ["low_word_count"] : []),
    ...(/(?:lorem ipsum|coming soon|placeholder|tbd|todo)/i.test(args.text)
      ? ["placeholder_language"]
      : []),
    ...(/^\s*(overview|stub|draft)\s*$/im.test(args.text) ? ["thin_heading_only"] : [])
  ];
  const sourceTier = args.storagePath.startsWith("Features/") ? "fallback" : "preferred";

  return {
    isStubCandidate: stubSignals.length > 0,
    sourcePriority: sourceTier === "preferred" ? 100 : 20,
    sourceTier,
    stubSignals,
    warnings: args.warnings,
    wordCount
  };
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function getExtension(fileName: string): string {
  const segments = fileName.toLowerCase().split(".");
  return segments[segments.length - 1] ?? "";
}
