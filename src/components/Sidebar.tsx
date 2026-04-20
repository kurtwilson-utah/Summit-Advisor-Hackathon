import { LogOut, MessageSquareText, Plus } from "lucide-react";
import { formatHistoryTimestamp, getThreadActivityTimestamp } from "../lib/chatEngine";
import type { ChatThread } from "../lib/types";

interface SidebarProps {
  threads: ChatThread[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  isOpen: boolean;
  onSignOut: () => void;
}

export function Sidebar({
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  isOpen,
  onSignOut
}: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-top">
        <div>
          <p className="eyebrow">Cyncly Advisor</p>
          <h1>Chats</h1>
        </div>
      </div>

      <button className="primary-button" onClick={onNewThread} type="button">
        <Plus size={18} />
        New chat
      </button>

      <div className="sidebar-section">
        <div className="section-heading">
          <span>Recent chats</span>
        </div>

        <div className="thread-list">
          {threads.map((thread) => {
            const isSelected = thread.id === selectedThreadId;

            return (
              <button
                key={thread.id}
                className={`thread-card ${isSelected ? "thread-card-selected" : ""}`}
                onClick={() => onSelectThread(thread.id)}
                type="button"
              >
                <div className="thread-title-group">
                  <MessageSquareText size={16} />
                  <span>{thread.title}</span>
                </div>

                <p>{thread.summary}</p>

                <div className="thread-card-footer">
                  <span>{thread.statusLabel}</span>
                  <span>{formatHistoryTimestamp(getThreadActivityTimestamp(thread))}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="secondary-button sidebar-signout" onClick={onSignOut} type="button">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
