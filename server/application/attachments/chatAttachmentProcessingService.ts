import type { ChatAttachmentPayload } from "../../../shared/chat.js";
import type { DocumentExtractionAdapter } from "../../providers/rag/documentExtractionAdapter.js";
import type { ChatAttachmentStorageAdapter } from "../../providers/attachments/supabaseChatAttachmentStorageAdapter.js";

export interface ClaudeImageInput {
  attachmentName: string;
  base64Data: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export interface ProcessedChatAttachment {
  attachment: ChatAttachmentPayload;
  extractedText: string | null;
  storagePath: string;
  storageBucket: string;
  warnings: string[];
}

export interface ProcessedAttachmentBatch {
  attachments: ProcessedChatAttachment[];
  imageInputs: ClaudeImageInput[];
  warnings: string[];
}

export interface ChatAttachmentProcessingService {
  processAttachments(args: { threadId: string; attachments: ChatAttachmentPayload[] }): Promise<ProcessedAttachmentBatch>;
}

export function createChatAttachmentProcessingService(dependencies: {
  extractionAdapter: DocumentExtractionAdapter;
  storageAdapter: ChatAttachmentStorageAdapter;
}): ChatAttachmentProcessingService {
  return {
    async processAttachments({ threadId, attachments }) {
      const processedAttachments: ProcessedChatAttachment[] = [];
      const imageInputs: ClaudeImageInput[] = [];
      const warnings: string[] = [];

      for (const attachment of attachments) {
        const buffer = decodeBase64Attachment(attachment);
        const persisted = await dependencies.storageAdapter.persistAttachment({
          threadId,
          attachment,
          buffer
        });
        const attachmentWarnings: string[] = [];
        let extractedText: string | null = null;

        if (attachment.kind === "image") {
          const imageInput = toClaudeImageInput(attachment);

          if (imageInput) {
            imageInputs.push(imageInput);
          } else {
            attachmentWarnings.push(`Image type ${attachment.mimeType} is not supported for live Claude vision input.`);
          }
        } else if (attachment.kind === "video") {
          attachmentWarnings.push("Video attachments are stored, but live video analysis is not connected yet.");
        } else {
          const extractionResult = await dependencies.extractionAdapter.extract({
            fileName: attachment.name,
            storagePath: persisted.storagePath,
            buffer
          });

          if (extractionResult?.text) {
            extractedText = truncateText(extractionResult.text, 10_000);
            attachmentWarnings.push(...extractionResult.metadata.warnings);

            if (extractionResult.text.length > extractedText.length) {
              attachmentWarnings.push(`Only the first ${extractedText.length} characters of ${attachment.name} were provided to Claude.`);
            }
          } else if (attachment.kind !== "other") {
            attachmentWarnings.push(`No extractable text was produced for ${attachment.name}.`);
          }
        }

        if (attachmentWarnings.length > 0) {
          warnings.push(...attachmentWarnings);
        }

        processedAttachments.push({
          attachment,
          extractedText,
          storagePath: persisted.storagePath,
          storageBucket: persisted.storageBucket,
          warnings: attachmentWarnings
        });
      }

      return {
        attachments: processedAttachments,
        imageInputs,
        warnings
      };
    }
  };
}

function decodeBase64Attachment(attachment: ChatAttachmentPayload) {
  return Buffer.from(attachment.dataBase64, "base64");
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function toClaudeImageInput(attachment: ChatAttachmentPayload): ClaudeImageInput | null {
  const mediaType = normalizeClaudeImageMediaType(attachment.mimeType);

  if (!mediaType) {
    return null;
  }

  return {
    attachmentName: attachment.name,
    base64Data: attachment.dataBase64,
    mediaType
  };
}

function normalizeClaudeImageMediaType(mimeType: string): ClaudeImageInput["mediaType"] | null {
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/gif" ||
    mimeType === "image/webp"
  ) {
    return mimeType;
  }

  if (mimeType === "image/jpg") {
    return "image/jpeg";
  }

  return null;
}
