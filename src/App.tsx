import { Database, Lock, LogOut, PanelLeft, Sparkles } from "lucide-react";
import { Composer } from "./components/Composer";
import { EmailGate } from "./components/EmailGate";
import { MessageBubble } from "./components/MessageBubble";
import { Sidebar } from "./components/Sidebar";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { useEmailAccess } from "./hooks/useEmailAccess";
import { useChatWorkspace } from "./hooks/useChatWorkspace";
import { defaultTheme } from "./lib/theme";

function App() {
  const {
    emailDraft,
    errorMessage,
    isSubmitting,
    session,
    setEmailDraft,
    signOut,
    submitEmail
  } = useEmailAccess();
  const {
    activeThread,
    activeThinkingState,
    attachments,
    draft,
    handleAddFiles,
    handleNewThread,
    handleRemoveAttachment,
    handleSend,
    isSending,
    isSidebarOpen,
    setDraft,
    setIsSidebarOpen,
    setSelectedThreadId,
    threads
  } = useChatWorkspace(session);
  const supportingAgentCount = activeThread.agentStates.filter(
    (agent) => agent.key !== "summit-product-manager"
  ).length;

  function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 940px)").matches;
  }

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId);

    if (isMobileViewport()) {
      setIsSidebarOpen(false);
    }
  }

  function handleCreateThread() {
    handleNewThread();

    if (isMobileViewport()) {
      setIsSidebarOpen(false);
    }
  }

  if (!session) {
    return (
      <EmailGate
        emailDraft={emailDraft}
        errorMessage={errorMessage}
        isSubmitting={isSubmitting}
        onEmailDraftChange={setEmailDraft}
        onSubmit={submitEmail}
      />
    );
  }

  return (
    <div className="app-shell">
      <button
        aria-hidden={!isSidebarOpen}
        aria-label="Close chat history"
        className={`sidebar-backdrop ${isSidebarOpen ? "sidebar-backdrop-visible" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
        type="button"
      />

      <Sidebar
        threads={threads}
        selectedThreadId={activeThread.id}
        onSelectThread={handleSelectThread}
        onNewThread={handleCreateThread}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen((current) => !current)}
      />

      <main className="workspace">
        <header className="app-header">
          <div className="header-title-group">
            <button
              className="mobile-sidebar-button secondary-button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              type="button"
            >
              <PanelLeft size={18} />
            </button>

            <div>
              <p className="eyebrow">Cyncly Advisor</p>
              <h2>{activeThread.title}</h2>
              <p className="header-subtitle">
                The Summit Product Manager responds publicly and can delegate to {supportingAgentCount} supporting
                agent{supportingAgentCount === 1 ? "" : "s"} behind the scenes.
              </p>
            </div>
          </div>

          <div className="header-badges">
            <span className="header-pill">
              <Sparkles size={14} />
              {defaultTheme.name}
            </span>
            <span className="header-pill">
              <Lock size={14} />
              PII protected
            </span>
            <span className="header-pill">
              <Database size={14} />
              Runtime ready
            </span>
            <span className="header-pill">
              <Lock size={14} />
              {session.email}
            </span>
            <button className="secondary-button header-signout" onClick={signOut} type="button">
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </header>

        <section className="conversation-window">
          <div className="conversation-inner">
            <section className="conversation-note">
              <p className="eyebrow">Thread status</p>
              <h3>{activeThread.statusLabel}</h3>
              <p>
                Context compression is active for this thread, and finalized conversations are prepared for downstream
                Notion export.
              </p>
            </section>

            <section className="message-list">
              {activeThread.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {activeThinkingState?.threadId === activeThread.id ? (
                <ThinkingIndicator step={activeThinkingState.step} />
              ) : null}
            </section>
          </div>
        </section>

        <footer className="app-footer">
          <Composer
            draft={draft}
            attachments={attachments}
            isSending={isSending}
            onDraftChange={setDraft}
            onAddFiles={handleAddFiles}
            onRemoveAttachment={handleRemoveAttachment}
            onSend={handleSend}
          />
        </footer>
      </main>
    </div>
  );
}

export default App;
