import { ImagePlus, Paperclip, Send, X } from "lucide-react";
import type { DraftAttachment } from "../lib/types";

interface ComposerProps {
  draft: string;
  attachments: DraftAttachment[];
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSend: () => void;
}

export function Composer({
  draft,
  attachments,
  isSending,
  onDraftChange,
  onAddFiles,
  onRemoveAttachment,
  onSend
}: ComposerProps) {
  return (
    <section className="composer-shell">
      <div className="composer-info">
        <span>Client-side protection is enabled before Claude dispatch.</span>
        <span>Attachments stay private until the backend ingestion pipeline is connected.</span>
      </div>

      {attachments.length ? (
        <div className="composer-attachments">
          {attachments.map((attachment) => (
            <div className="attachment-pill" key={attachment.id}>
              <span>{attachment.name}</span>
              <small>{attachment.sizeLabel}</small>
              <button
                aria-label={`Remove ${attachment.name}`}
                className="attachment-remove"
                onClick={() => onRemoveAttachment(attachment.id)}
                type="button"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="composer-panel">
        <div className="composer-left-actions">
          <label className="secondary-button icon-action">
            <Paperclip size={16} />
            <span>Attach</span>
            <input hidden multiple onChange={(event) => onAddFiles(event.target.files)} type="file" />
          </label>

          <label className="secondary-button icon-action">
            <ImagePlus size={16} />
            <span>Image</span>
            <input accept="image/*" hidden multiple onChange={(event) => onAddFiles(event.target.files)} type="file" />
          </label>
        </div>

        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Message Cyncly Advisor..."
          rows={3}
        />

        <button
          aria-label={isSending ? "Sending message" : "Send message"}
          className="send-button"
          disabled={isSending}
          onClick={onSend}
          type="button"
        >
          <Send size={17} />
        </button>
      </div>
    </section>
  );
}
