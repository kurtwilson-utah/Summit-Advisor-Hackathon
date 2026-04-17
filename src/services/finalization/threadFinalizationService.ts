import type { ChatThread } from "../../lib/types";

export interface ThreadFinalizationService {
  markPendingExport(thread: ChatThread): ChatThread;
}

export function createThreadFinalizationService(): ThreadFinalizationService {
  return {
    markPendingExport(thread) {
      return {
        ...thread,
        notionStatus: "Finalize pending"
      };
    }
  };
}
