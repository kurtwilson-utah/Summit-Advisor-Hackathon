import { FileSpreadsheet, FileText, Image, Sparkles, Video } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { formatTimestamp } from "../lib/chatEngine";
import type { QuickReplyOption } from "../lib/quickReplies";
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
  quickReplies?: QuickReplyOption[];
  onQuickReplySelect?: (value: string) => void;
  quickRepliesDisabled?: boolean;
}

export function MessageBubble({
  message,
  quickReplies = [],
  onQuickReplySelect,
  quickRepliesDisabled = false
}: MessageBubbleProps) {
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
        </div>

        <div className="message-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              a: ({ node, ...props }) => <a {...props} rel="noreferrer" target="_blank" />,
              code: ({ className, children, ...props }) => {
                const isBlock = Boolean(className?.includes("language-"));

                if (isBlock) {
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }

                return (
                  <code {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {message.bodyDisplay}
          </ReactMarkdown>
        </div>

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

        {quickReplies.length ? (
          <div className="message-quick-replies">
            {quickReplies.map((quickReply) => (
              <button
                key={quickReply.id}
                className="quick-reply-button"
                disabled={quickRepliesDisabled}
                onClick={() => onQuickReplySelect?.(quickReply.value)}
                type="button"
              >
                {quickReply.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
