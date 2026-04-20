import { Hand } from "lucide-react";
import { getEmptyThreadGreeting } from "../lib/chatEngine";
import type { QuickReplyOption } from "../lib/quickReplies";

interface EmptyThreadStateProps {
  displayName?: string | null;
  quickReplies?: QuickReplyOption[];
  quickRepliesDisabled?: boolean;
  onQuickReplySelect?: (value: string) => void;
}

export function EmptyThreadState({
  displayName,
  quickReplies = [],
  quickRepliesDisabled = false,
  onQuickReplySelect
}: EmptyThreadStateProps) {
  return (
    <div className="empty-thread-state">
      <div className="empty-thread-icon" aria-hidden="true">
        <Hand size={18} />
      </div>

      <div className="empty-thread-copy">
        <p>{getEmptyThreadGreeting(displayName)}</p>
      </div>

      {quickReplies.length ? (
        <div className="empty-thread-quick-replies">
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
  );
}
