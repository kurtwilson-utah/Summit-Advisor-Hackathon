import { MessageSquareText, PanelLeft, Plus, Search } from "lucide-react";
import { formatHistoryTimestamp } from "../lib/chatEngine";
import type { ChatThread } from "../lib/types";

interface SidebarProps {
  threads: ChatThread[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export function Sidebar({
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  isOpen,
  onToggleOpen
}: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-top">
        <button className="sidebar-toggle" onClick={onToggleOpen} type="button" aria-label="Toggle sidebar">
          <PanelLeft size={18} />
        </button>

        <div>
          <p className="eyebrow">Cyncly Advisor</p>
          <h1>Chats</h1>
        </div>
      </div>

      <button className="primary-button" onClick={onNewThread} type="button">
        <Plus size={18} />
        New chat
      </button>

      <label className="search-shell" aria-label="Search chats">
        <Search size={16} />
        <input disabled placeholder="Search threads (hook up later)" />
      </label>

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
                  <span>{formatHistoryTimestamp(thread.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
