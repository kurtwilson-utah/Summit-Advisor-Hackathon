import { appConfig } from "../config/appConfig";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAttachmentDraft, createEmptyThread } from "../lib/chatEngine";
import { applyTheme, defaultTheme } from "../lib/theme";
import type { ActiveThinkingState, ChatThread, DraftAttachment, EmailAccessSession } from "../lib/types";
import { createThreadFinalizationService } from "../services/finalization/threadFinalizationService";
import { createTurnOrchestrationService } from "../services/orchestration/turnOrchestrationService";
import { createThreadPersistenceService } from "../services/persistence/threadPersistenceService";
import { createApiConversationProvider } from "../services/providers/apiConversationProvider";
import { createMockConversationProvider } from "../services/providers/mockConversationProvider";
import { createChatWorkspaceRuntime } from "../services/runtime/chatWorkspaceRuntime";

const persistenceService = createThreadPersistenceService();
const providerAdapter = appConfig.useMockBackend ? createMockConversationProvider() : createApiConversationProvider();
const runtime = createChatWorkspaceRuntime({
  finalizationService: createThreadFinalizationService(),
  orchestrationService: createTurnOrchestrationService(),
  providerAdapter
});
const initialThreads = persistenceService.loadThreads() ?? [createEmptyThread()];

export function useChatWorkspace(session: EmailAccessSession | null) {
  const [threads, setThreads] = useState<ChatThread[]>(() => initialThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string>(() => initialThreads[0].id);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 940
  );
  const [activeThinkingState, setActiveThinkingState] = useState<ActiveThinkingState | null>(null);
  const finalizingThreadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    applyTheme(defaultTheme);
  }, []);

  useEffect(() => {
    // Persist after every thread mutation so reloads behave more like a real chat client.
    persistenceService.saveThreads(threads);
  }, [threads]);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    void persistenceService
      .loadRemoteThreads(session)
      .then((remoteThreads) => {
        if (cancelled || remoteThreads.length === 0) {
          return;
        }

        setThreads((currentThreads) => mergeThreads(remoteThreads, currentThreads));
        setSelectedThreadId((currentSelectedThreadId) =>
          remoteThreads.some((thread) => thread.id === currentSelectedThreadId)
            ? currentSelectedThreadId
            : remoteThreads[0].id
        );
      })
      .catch((error) => {
        console.error("Unable to hydrate remote threads.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || appConfig.useMockBackend || threads.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistenceService.syncThreads(session, threads).catch((error) => {
        console.error("Unable to sync threads.", error);
      });
    }, 75);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [session, threads]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0],
    [selectedThreadId, threads]
  );

  useEffect(() => {
    if (!session || appConfig.useMockBackend || !activeThread || activeThread.notionStatus !== "Finalize pending") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void requestFinalization(activeThread, session, "idle-timeout");
    }, 90_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeThread, session]);

  useEffect(() => {
    if (!session || appConfig.useMockBackend) {
      return;
    }

    const handlePageHide = () => {
      if (!activeThread || activeThread.notionStatus !== "Finalize pending") {
        return;
      }

      void requestFinalization(activeThread, session, "browser-unload", true);
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [activeThread, session]);

  function updateThread(threadId: string, updater: (thread: ChatThread) => ChatThread) {
    setThreads((currentThreads) =>
      currentThreads.map((thread) => (thread.id === threadId ? updater(thread) : thread))
    );
  }

  function handleNewThread() {
    const newThread = runtime.createThread();

    setThreads((currentThreads) => [newThread, ...currentThreads]);
    setSelectedThreadId(newThread.id);
    setDraft("");
    setAttachments([]);
    setActiveThinkingState(null);
  }

  function handleAddFiles(files: FileList | null) {
    if (!files) {
      return;
    }

    const nextAttachments = Array.from(files).map(createAttachmentDraft);
    setAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);
  }

  function handleRemoveAttachment(attachmentId: string) {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId)
    );
  }

  async function handleSend() {
    if (!activeThread) {
      return;
    }

    const currentDraft = draft;
    const currentAttachments = attachments;

    setDraft("");
    setAttachments([]);
    setIsSending(true);

    const didSubmit = await runtime.submitTurn({
      thread: activeThread,
      draft: currentDraft,
      attachments: currentAttachments,
      onOptimisticUpdate(thread) {
        updateThread(thread.id, () => thread);
      },
      onThinkingStep(step) {
        setActiveThinkingState(step ? { threadId: activeThread.id, step } : null);
      },
      onComplete(thread) {
        updateThread(thread.id, () => thread);
      }
    });

    if (!didSubmit) {
      setDraft(currentDraft);
      setAttachments(currentAttachments);
    }

    setIsSending(false);
  }

  async function requestFinalization(
    thread: ChatThread,
    currentSession: EmailAccessSession,
    closeReason: "manual-close" | "idle-timeout" | "browser-unload",
    keepalive = false
  ) {
    if (finalizingThreadIdsRef.current.has(thread.id)) {
      return;
    }

    finalizingThreadIdsRef.current.add(thread.id);

    try {
      await persistenceService.finalizeThread({
        session: currentSession,
        thread,
        closeReason,
        keepalive
      });

      updateThread(thread.id, (currentThread) => ({
        ...currentThread,
        notionStatus: "Transcript synced"
      }));
    } catch (error) {
      console.error("Unable to finalize conversation.", error);

      updateThread(thread.id, (currentThread) => ({
        ...currentThread,
        notionStatus: "Finalization failed"
      }));
    } finally {
      finalizingThreadIdsRef.current.delete(thread.id);
    }
  }

  return {
    activeThread,
    activeThinkingState,
    attachments,
    draft,
    isSending,
    isSidebarOpen,
    selectedThreadId,
    setDraft,
    setIsSidebarOpen,
    setSelectedThreadId,
    threads,
    handleAddFiles,
    handleNewThread,
    handleRemoveAttachment,
    handleSend
  };
}

function mergeThreads(remoteThreads: ChatThread[], localThreads: ChatThread[]) {
  const mergedThreads = new Map<string, ChatThread>();

  for (const thread of [...localThreads, ...remoteThreads]) {
    const existing = mergedThreads.get(thread.id);

    if (!existing || new Date(thread.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      mergedThreads.set(thread.id, thread);
    }
  }

  return Array.from(mergedThreads.values()).sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}
