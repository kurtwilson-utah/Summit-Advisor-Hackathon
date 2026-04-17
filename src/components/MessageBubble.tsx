import { FileSpreadsheet, FileText, Image, ShieldCheck, Sparkles, Video } from "lucide-react";
import { formatTimestamp } from "../lib/chatEngine";
import type { AttachmentKind, ChatMessage } from "../lib/types";

const attachmentIcons: Record<AttachmentKind, typeof Image> = {
  image: Image,
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  video: Video,
  other: FileText
};

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <article className={`message-row ${isUser ? "message-row-user" : ""}`}>
      {!isUser ? (
        <div className="message-avatar" aria-hidden="true">
          <Sparkles size={16} />
        </div>
      ) : null}

      <div className={`message-bubble ${isUser ? "message-bubble-user" : ""}`}>
        <div className="message-meta">
          <div>
            <strong>{message.authorLabel}</strong>
            <span>{formatTimestamp(message.createdAt)}</span>
          </div>

          {message.redaction?.entities.length ? (
            <div className="pii-pill">
              <ShieldCheck size={14} />
              {message.redaction.entities.length} protected field
              {message.redaction.entities.length === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>

        <p>{message.bodyDisplay}</p>

        {message.attachments?.length ? (
          <div className="attachment-stack">
            {message.attachments.map((attachment) => {
              const Icon = attachmentIcons[attachment.kind];

              return (
                <div className="attachment-pill" key={attachment.id}>
                  <Icon size={14} />
                  <span>{attachment.name}</span>
                  <small>{attachment.sizeLabel}</small>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
}
