import { useEffect, useRef, type KeyboardEvent } from "react";
import { Paperclip, Send, X } from "lucide-react";
import type { PendingAttachmentDraft } from "../lib/types";

interface ComposerProps {
  draft: string;
  attachments: PendingAttachmentDraft[];
  isSending: boolean;
  maxHeight: number;
  onDraftChange: (value: string) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSend: () => void;
}

export function Composer({
  draft,
  attachments,
  isSending,
  maxHeight,
  onDraftChange,
  onAddFiles,
  onRemoveAttachment,
  onSend
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(44, nextHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft, maxHeight]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (!isSending) {
      onSend();
    }
  }

  return (
    <section className="composer-shell">
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
        <button
          aria-label="Attach files"
          className="secondary-button icon-action composer-attach-action"
          onClick={() => fileInputRef.current?.click()}
          title="Attach files"
          type="button"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          hidden
          multiple
          onChange={(event) => {
            onAddFiles(event.target.files);
            event.target.value = "";
          }}
          type="file"
        />

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Cyncly Advisor..."
          rows={1}
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
