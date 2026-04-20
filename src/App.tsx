import { PanelLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Composer } from "./components/Composer";
import { EmailGate } from "./components/EmailGate";
import { MessageBubble } from "./components/MessageBubble";
import { Sidebar } from "./components/Sidebar";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { useEmailAccess } from "./hooks/useEmailAccess";
import { useEmbeddedBridge } from "./hooks/useEmbeddedBridge";
import { useChatWorkspace } from "./hooks/useChatWorkspace";

function App() {
  const embeddedBridge = useEmbeddedBridge();
  const {
    emailDraft,
    errorMessage,
    isSubmitting,
    session,
    setEmailDraft,
    signOut,
    submitEmail
  } = useEmailAccess({
    isEmbeddedMode: embeddedBridge.isEmbeddedMode,
    embeddedBootstrapUser: embeddedBridge.bootstrapUser
  });
  const {
    activeThread,
    activeThinkingState,
    attachments,
    contextItems,
    draft,
    handleAddFiles,
    handleNewThread,
    handleRemoveContextItem,
    handleRemoveAttachment,
    handleSelectThread,
    handleSend,
    isSending,
    isSidebarOpen,
    setDraft,
    setIsSidebarOpen,
    threads
  } = useChatWorkspace(session, {
    isEmbeddedMode: embeddedBridge.isEmbeddedMode,
    currentPageTitle: embeddedBridge.currentPageTitle,
    widgetOpenSequence: embeddedBridge.widgetOpenSequence,
    lastWidgetOpenedAt: embeddedBridge.lastWidgetOpenedAt,
    lastWidgetClosedAt: embeddedBridge.lastWidgetClosedAt
  });
  const conversationWindowRef = useRef<HTMLElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const [composerMaxHeight, setComposerMaxHeight] = useState(180);

  function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 940px)").matches;
  }

  useEffect(() => {
    const root = document.documentElement;

    const updateViewportMetrics = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport ? Math.round(viewport.height + viewport.offsetTop) : window.innerHeight;
      root.style.setProperty("--app-height", `${viewportHeight}px`);
    };

    updateViewportMetrics();

    const viewport = window.visualViewport;
    window.addEventListener("resize", updateViewportMetrics);
    viewport?.addEventListener("resize", updateViewportMetrics);
    viewport?.addEventListener("scroll", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      viewport?.removeEventListener("resize", updateViewportMetrics);
      viewport?.removeEventListener("scroll", updateViewportMetrics);
      root.style.removeProperty("--app-height");
    };
  }, []);

  useEffect(() => {
    const windowElement = conversationWindowRef.current;

    if (!windowElement) {
      return;
    }

    const updateComposerMaxHeight = () => {
      setComposerMaxHeight(Math.max(120, Math.floor(windowElement.clientHeight / 3)));
    };

    updateComposerMaxHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateComposerMaxHeight);

      return () => {
        window.removeEventListener("resize", updateComposerMaxHeight);
      };
    }

    const observer = new ResizeObserver(updateComposerMaxHeight);
    observer.observe(windowElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const conversationWindow = conversationWindowRef.current;

      if (conversationWindow) {
        conversationWindow.scrollTop = conversationWindow.scrollHeight;
      }

      conversationEndRef.current?.scrollIntoView({
        block: "end"
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeThread.id, activeThread.messages.length, activeThinkingState?.step.key]);

  function handleThreadSelection(threadId: string) {
    handleSelectThread(threadId);

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
    if (embeddedBridge.isEmbeddedMode) {
      return (
        <div className="embedded-pending-shell">
          <div className="embedded-pending-card">
            <div className="message-avatar" aria-hidden="true">
              <PanelLeft size={16} />
            </div>
            <div>
              <h2>Cyncly Advisor</h2>
              <p>
                {errorMessage
                  ? errorMessage
                  : embeddedBridge.bootstrapReady
                    ? "Connecting your Summit session..."
                    : "Waiting for Summit context..."}
              </p>
            </div>
          </div>
        </div>
      );
    }

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
    <div
      className={`app-shell ${embeddedBridge.isEmbeddedMode ? "app-shell-embedded" : ""} ${isSidebarOpen ? "app-shell-sidebar-open" : "app-shell-sidebar-closed"}`}
    >
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
          onSelectThread={handleThreadSelection}
          onNewThread={handleCreateThread}
          isOpen={isSidebarOpen}
          onSignOut={signOut}
          showSignOut={!embeddedBridge.isEmbeddedMode}
      />

      <main className={`workspace ${embeddedBridge.isEmbeddedMode ? "workspace-embedded" : ""}`}>
        <header className="app-header">
          <div className="header-title-group">
            <button
              aria-label={isSidebarOpen ? "Hide chat history" : "Show chat history"}
              className="sidebar-launcher-button secondary-button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              type="button"
            >
              <PanelLeft size={22} />
            </button>

            <div>
              <h2>{activeThread.title}</h2>
            </div>
          </div>
        </header>

        <section className="conversation-window" ref={conversationWindowRef}>
          <div className="conversation-inner">
            <section className="message-list">
              {activeThread.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {activeThinkingState?.threadId === activeThread.id ? (
                <ThinkingIndicator step={activeThinkingState.step} />
              ) : null}
              <div aria-hidden="true" ref={conversationEndRef} />
            </section>
          </div>
        </section>

        <footer className="app-footer">
          <Composer
            draft={draft}
            attachments={attachments}
            contextItems={contextItems}
            isSending={isSending}
            onDraftChange={setDraft}
            onAddFiles={handleAddFiles}
            onRemoveContextItem={handleRemoveContextItem}
            onRemoveAttachment={handleRemoveAttachment}
            onSend={handleSend}
            maxHeight={composerMaxHeight}
          />
        </footer>
      </main>
    </div>
  );
}

export default App;
