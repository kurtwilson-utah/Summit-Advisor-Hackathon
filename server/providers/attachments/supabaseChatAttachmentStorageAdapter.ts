import { createSupabaseAdminClient } from "../../lib/supabaseAdmin.js";
import { env } from "../../lib/config.js";
import type { ChatAttachmentPayload } from "../../../shared/chat.js";

export interface PersistedChatAttachment {
  fileAssetId: string;
  storageBucket: string;
  storagePath: string;
}

export interface ChatAttachmentStorageAdapter {
  persistAttachment(args: {
    threadId: string;
    attachment: ChatAttachmentPayload;
    buffer: Buffer;
  }): Promise<PersistedChatAttachment>;
}

export function createSupabaseChatAttachmentStorageAdapter(): ChatAttachmentStorageAdapter {
  const client = createSupabaseAdminClient();
  const bucket = env.SUPABASE_CHAT_ATTACHMENTS_BUCKET;

  return {
    async persistAttachment({ threadId, attachment, buffer }) {
      const storagePath = buildStoragePath(threadId, attachment);
      const uploadResult = await client.storage.from(bucket).upload(storagePath, buffer, {
        contentType: attachment.mimeType,
        upsert: true
      });

      if (uploadResult.error) {
        throw new Error(
          `Unable to upload ${attachment.name} to Supabase storage: ${uploadResult.error.message}. ` +
            `Make sure the private "${bucket}" bucket exists.`
        );
      }

      const existing = await client
        .from("file_assets")
        .select("id")
        .eq("storage_bucket", bucket)
        .eq("storage_path", storagePath)
        .maybeSingle();

      if (existing.error) {
        throw existing.error;
      }

      if (existing.data?.id) {
        const updateResult = await client
          .from("file_assets")
          .update({
            owner_id: null,
            mime_type: attachment.mimeType,
            original_name: attachment.name,
            kind: "chat-attachment",
            size_bytes: attachment.sizeBytes
          })
          .eq("id", existing.data.id);

        if (updateResult.error) {
          throw updateResult.error;
        }

        return {
          fileAssetId: existing.data.id,
          storageBucket: bucket,
          storagePath
        };
      }

      const insertResult = await client
        .from("file_assets")
        .insert({
          owner_id: null,
          storage_bucket: bucket,
          storage_path: storagePath,
          mime_type: attachment.mimeType,
          original_name: attachment.name,
          kind: "chat-attachment",
          size_bytes: attachment.sizeBytes
        })
        .select("id")
        .single();

      if (insertResult.error || !insertResult.data) {
        const message = insertResult.error?.message ?? `Unable to save attachment metadata for ${attachment.name}.`;

        if (/null value in column "owner_id"/i.test(message)) {
          throw new Error(
            'The shared asset migration has not been run yet. Run: alter table public.file_assets alter column owner_id drop not null;'
          );
        }

        throw insertResult.error ?? new Error(message);
      }

      return {
        fileAssetId: insertResult.data.id,
        storageBucket: bucket,
        storagePath
      };
    }
  };
}

function buildStoragePath(threadId: string, attachment: ChatAttachmentPayload) {
  return `${threadId}/${attachment.id}-${sanitizeFileName(attachment.name)}`;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
