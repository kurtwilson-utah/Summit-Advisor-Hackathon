import { appConfig } from "../config/appConfig";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAttachmentDraft,
  createEmptyThread,
  getThreadActivityTimestamp,
  isUnsentDraftThread,
  normalizeThreadCollection
} from "../lib/chatEngine";
import { applyTheme, defaultTheme } from "../lib/theme";
import type {
  ActiveThinkingState,
  ChatContextItemPayload,
  ChatThread,
  EmailAccessSession,
  HiddenHostPageContextPayload,
  PendingAttachmentDraft
} from "../lib/types";
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

function loadInitialThreadsForSession(session: EmailAccessSession | null): ChatThread[] {
  if (session?.email) {
    const stored = persistenceService.loadThreads(session.email);

    if (stored && stored.length > 0) {
      return normalizeThreadCollection(stored);
    }
  }

  return [createEmptyThread(session?.displayName)];
}

function createHostContextItems(pageTitle: string | null) {
  if (!pageTitle) {
    return [] as ChatContextItemPayload[];
  }

  return [
    {
      id: "current-page-title",
      label: "Current page",
      value: pageTitle
    }
  ];
}

function resolveActiveHiddenHostPageContext(
  contextItems: ChatContextItemPayload[],
  hiddenHostPageContext: HiddenHostPageContextPayload | null | undefined
) {
  const currentPageItem = contextItems.find((item) => item.id === "current-page-title");

  if (!currentPageItem || !hiddenHostPageContext) {
    return null;
  }

  return currentPageItem.value === hiddenHostPageContext.routeLabel ? hiddenHostPageContext : null;
}

export function useChatWorkspace(
  session: EmailAccessSession | null,
  options?: {
    isEmbeddedMode?: boolean;
    currentPageTitle?: string | null;
    hiddenHostPageContext?: HiddenHostPageContextPayload | null;
    widgetOpenSequence?: number;
    lastWidgetOpenedAt?: number | null;
    lastWidgetClosedAt?: number | null;
  }
) {
  const [threads, setThreads] = useState<ChatThread[]>(() => loadInitialThreadsForSession(session));
  const [selectedThreadId, setSelectedThreadId] = useState<string>(() => threads[0].id);
  const sessionEmail = session?.email ?? null;
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachmentDraft[]>([]);
  const [contextItems, setContextItems] = useState<ChatContextItemPayload[]>(() =>
    createHostContextItems(options?.isEmbeddedMode ? options.currentPageTitle ?? null : null)
  );
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === "undefined" ? !options?.isEmbeddedMode : !options?.isEmbeddedMode && window.innerWidth > 940
  );
  const [activeThinkingState, setActiveThinkingState] = useState<ActiveThinkingState | null>(null);
  const threadsRef = useRef<ChatThread[]>(threads);
  const finalizingThreadIdsRef = useRef<Set<string>>(new Set());
  const refreshInFlightRef = useRef(false);
  const lastHandledWidgetOpenSequenceRef = useRef(0);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    applyTheme(defaultTheme);
    persistenceService.clearUnscopedLegacy();
  }, []);

  useEffect(() => {
    if (!sessionEmail) {
      const emptyThread = createEmptyThread();
      setThreads([emptyThread]);
      setSelectedThreadId(emptyThread.id);
      return;
    }

    const stored = persistenceService.loadThreads(sessionEmail);

    if (stored && stored.length > 0) {
      const orderedThreads = normalizeThreadCollection(stored);
      setThreads(orderedThreads);
      setSelectedThreadId(orderedThreads[0].id);
    } else {
      const emptyThread = createEmptyThread(session?.displayName);
      setThreads([emptyThread]);
      setSelectedThreadId(emptyThread.id);
    }
  }, [session, sessionEmail]);

  useEffect(() => {
    if (!options?.isEmbeddedMode) {
      setContextItems([]);
      return;
    }

    setContextItems((currentItems) => {
      const nextItems = createHostContextItems(options.currentPageTitle ?? null);

      if (nextItems.length === 0) {
        return currentItems.length === 0 ? currentItems : [];
      }

      const currentPageItem = currentItems.find((item) => item.id === "current-page-title");

      if (currentPageItem?.value === nextItems[0].value) {
        return currentItems;
      }

      return nextItems;
    });
  }, [options?.currentPageTitle, options?.isEmbeddedMode]);

  useEffect(() => {
    if (!sessionEmail) {
      return;
    }

    persistenceService.saveThreads(sessionEmail, threads);
  }, [threads, sessionEmail]);

  useEffect(() => {
    if (!session || appConfig.useMockBackend) {
      return;
    }

    let cancelled = false;

    const refreshThreads = async () => {
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        const remoteThreads = await persistenceService.loadRemoteThreads(session);

        if (cancelled) {
          return;
        }

        setThreads((currentThreads) => {
          const mergedThreads = mergeThreads(remoteThreads, currentThreads);

          setSelectedThreadId((currentSelectedThreadId) =>
            resolveSelectedThreadId(currentSelectedThreadId, currentThreads, mergedThreads)
          );

          return mergedThreads;
        });
      } catch (error) {
        console.error("Unable to hydrate remote threads.", error);
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    void refreshThreads();

    const handleWindowFocus = () => {
      void refreshThreads();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshThreads();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session]);

  useEffect(() => {
    if (!sessionEmail) {
      return;
    }

    return persistenceService.subscribeToThreads(sessionEmail, (incomingThreads) => {
      setThreads((currentThreads) => {
        const mergedThreads = mergeThreads(incomingThreads, currentThreads);

        setSelectedThreadId((currentSelectedThreadId) =>
          resolveSelectedThreadId(currentSelectedThreadId, currentThreads, mergedThreads)
        );

        return mergedThreads;
      });
    });
  }, [sessionEmail]);

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

  useEffect(() => {
    if (!options?.isEmbeddedMode || !options.widgetOpenSequence) {
      return;
    }

    if (lastHandledWidgetOpenSequenceRef.current === options.widgetOpenSequence) {
      return;
    }

    lastHandledWidgetOpenSequenceRef.current = options.widgetOpenSequence;

    const shouldResetConversation =
      typeof options.lastWidgetOpenedAt === "number" &&
      typeof options.lastWidgetClosedAt === "number" &&
      options.lastWidgetOpenedAt - options.lastWidgetClosedAt >= 120_000;

    if (!shouldResetConversation) {
      return;
    }

    handleNewThread();
    setContextItems(createHostContextItems(options.currentPageTitle ?? null));
  }, [
    options?.currentPageTitle,
    options?.isEmbeddedMode,
    options?.lastWidgetClosedAt,
    options?.lastWidgetOpenedAt,
    options?.widgetOpenSequence
  ]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0],
    [selectedThreadId, threads]
  );

  useEffect(() => {
    if (threads.length === 0) {
      return;
    }

    if (!threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [selectedThreadId, threads]);

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
    setThreads((currentThreads) => {
      const nextThreads = normalizeThreadCollection(
        currentThreads.map((thread) => (thread.id === threadId ? updater(thread) : thread))
      );
      threadsRef.current = nextThreads;
      return nextThreads;
    });
  }

  function handleNewThread() {
    const currentThreads = threadsRef.current;
    const currentDraft = currentThreads.find(isUnsentDraftThread);
    const nextDraftThread = currentDraft ?? runtime.createThread(session?.displayName);
    const nextThreads = currentDraft
      ? normalizeThreadCollection(currentThreads)
      : normalizeThreadCollection([nextDraftThread, ...currentThreads]);
    const isAlreadyOnSelectedDraft = activeThread?.id === nextDraftThread.id && isUnsentDraftThread(activeThread);

    threadsRef.current = nextThreads;
    setThreads(nextThreads);
    setSelectedThreadId(nextDraftThread.id);

    if (isAlreadyOnSelectedDraft) {
      return;
    }

    setDraft("");
    setAttachments([]);
    setContextItems(createHostContextItems(options?.isEmbeddedMode ? options.currentPageTitle ?? null : null));
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

  function handleRemoveContextItem(contextItemId: string) {
    setContextItems((currentItems) => currentItems.filter((item) => item.id !== contextItemId));
  }

  async function submitTurn(args: {
    draftText: string;
    attachmentsToSend: PendingAttachmentDraft[];
    contextItemsToSend: ChatContextItemPayload[];
    preserveComposerState?: boolean;
  }) {
    if (!activeThread) {
      return false;
    }

    const currentDraft = args.draftText;
    const currentAttachments = args.attachmentsToSend;
    const currentContextItems = args.contextItemsToSend;
    const preserveComposerState = Boolean(args.preserveComposerState);
    const activeHiddenHostPageContext = resolveActiveHiddenHostPageContext(
      currentContextItems,
      options?.hiddenHostPageContext ?? null
    );

    if (!preserveComposerState) {
      setDraft("");
      setAttachments([]);
    }
    setIsSending(true);

    const didSubmit = await runtime.submitTurn({
      thread: activeThread,
      draft: currentDraft,
      attachments: currentAttachments,
      contextItems: currentContextItems,
      hiddenHostPageContext: activeHiddenHostPageContext,
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

    if (!didSubmit && !preserveComposerState) {
      setDraft(currentDraft);
      setAttachments(currentAttachments);
      setContextItems(currentContextItems);
    }

    setIsSending(false);
    return didSubmit;
  }

  async function handleSend() {
    await submitTurn({
      draftText: draft,
      attachmentsToSend: attachments,
      contextItemsToSend: contextItems
    });
  }

  async function handleQuickReplySend(replyText: string) {
    if (isSending) {
      return;
    }

    await submitTurn({
      draftText: replyText,
      attachmentsToSend: [],
      contextItemsToSend: contextItems,
      preserveComposerState: true
    });
  }

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId);

    if (!session || appConfig.useMockBackend || refreshInFlightRef.current) {
      return;
    }

    void persistenceService
      .loadRemoteThreads(session)
      .then((remoteThreads) => {
        if (remoteThreads.length === 0) {
          return;
        }

        setThreads((currentThreads) => mergeThreads(remoteThreads, currentThreads));
      })
      .catch((error) => {
        console.error("Unable to refresh selected thread.", error);
      });
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

      updateThread(thread.id, (currentThread) => {
        if (hasThreadAdvancedSinceFinalizationRequest(currentThread, thread)) {
          return currentThread;
        }

        return {
          ...currentThread,
          notionStatus: "Transcript synced"
        };
      });
    } catch (error) {
      console.error("Unable to finalize conversation.", error);

      updateThread(thread.id, (currentThread) => {
        if (hasThreadAdvancedSinceFinalizationRequest(currentThread, thread)) {
          return currentThread;
        }

        return {
          ...currentThread,
          notionStatus: "Finalization failed"
        };
      });
    } finally {
      finalizingThreadIdsRef.current.delete(thread.id);
    }
  }

  return {
    activeThread,
    activeThinkingState,
    attachments,
    contextItems,
    draft,
    isSending,
    isSidebarOpen,
    selectedThreadId,
    handleSelectThread,
    handleRemoveContextItem,
    setDraft,
    setIsSidebarOpen,
    threads,
    handleAddFiles,
    handleNewThread,
    handleQuickReplySend,
    handleRemoveAttachment,
    handleSend
  };
}

function mergeThreads(remoteThreads: ChatThread[], localThreads: ChatThread[]) {
  const mergedThreads = new Map<string, ChatThread>();

  for (const thread of localThreads) {
    mergedThreads.set(thread.id, thread);
  }

  for (const thread of remoteThreads) {
    const existing = mergedThreads.get(thread.id);
    mergedThreads.set(thread.id, existing ? mergeThreadSnapshots(existing, thread) : thread);
  }

  return normalizeThreadCollection(Array.from(mergedThreads.values()));
}

function resolveSelectedThreadId(
  currentSelectedThreadId: string,
  currentThreads: ChatThread[],
  mergedThreads: ChatThread[]
) {
  if (mergedThreads.some((thread) => thread.id === currentSelectedThreadId)) {
    return currentSelectedThreadId;
  }

  const currentSelectedThread = currentThreads.find((thread) => thread.id === currentSelectedThreadId);

  if (currentSelectedThread && isUnsentDraftThread(currentSelectedThread)) {
    const mergedDraft = mergedThreads.find((thread) => isUnsentDraftThread(thread));

    if (mergedDraft) {
      return mergedDraft.id;
    }
  }

  return mergedThreads[0]?.id ?? currentSelectedThreadId;
}

function hasThreadAdvancedSinceFinalizationRequest(currentThread: ChatThread, finalizedThread: ChatThread) {
  return (
    currentThread.updatedAt !== finalizedThread.updatedAt ||
    currentThread.messages.length !== finalizedThread.messages.length
  );
}

function shouldReplaceThread(currentThread: ChatThread, nextThread: ChatThread) {
  const currentActivity = new Date(getThreadActivityTimestamp(currentThread)).getTime();
  const nextActivity = new Date(getThreadActivityTimestamp(nextThread)).getTime();

  if (nextActivity !== currentActivity) {
    return nextActivity > currentActivity;
  }

  if (nextThread.messages.length !== currentThread.messages.length) {
    return nextThread.messages.length > currentThread.messages.length;
  }

  return new Date(nextThread.updatedAt).getTime() >= new Date(currentThread.updatedAt).getTime();
}

function mergeThreadSnapshots(currentThread: ChatThread, nextThread: ChatThread): ChatThread {
  const preferredThread = shouldReplaceThread(currentThread, nextThread) ? nextThread : currentThread;
  const mergedMessages = mergeMessages(currentThread.messages, nextThread.messages);

  return {
    ...preferredThread,
    updatedAt: mergedMessages[mergedMessages.length - 1]?.createdAt ?? preferredThread.updatedAt,
    messages: mergedMessages
  };
}

function mergeMessages(currentMessages: ChatThread["messages"], nextMessages: ChatThread["messages"]) {
  const mergedMessages = new Map<string, ChatThread["messages"][number]>();

  for (const message of [...currentMessages, ...nextMessages]) {
    const existing = mergedMessages.get(message.id);

    if (!existing || new Date(message.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      mergedMessages.set(message.id, message);
    }
  }

  return Array.from(mergedMessages.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}
