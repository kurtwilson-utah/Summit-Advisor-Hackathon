import { useEffect, useMemo, useState } from "react";

interface EmbeddedBootstrapPayload {
  name?: string;
  email?: string;
  pageTitle?: string;
}

interface WidgetLifecyclePayload {
  timestamp?: number;
}

interface BridgeMessage {
  source?: string;
  type?: string;
  payload?: EmbeddedBootstrapPayload | WidgetLifecyclePayload;
}

export interface EmbeddedBridgeState {
  isEmbeddedMode: boolean;
  bootstrapUser: { name: string; email: string } | null;
  currentPageTitle: string | null;
  bootstrapReady: boolean;
  widgetOpenSequence: number;
  lastWidgetOpenedAt: number | null;
  lastWidgetClosedAt: number | null;
}

export function useEmbeddedBridge(): EmbeddedBridgeState {
  const isEmbeddedMode = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return new URLSearchParams(window.location.search).get("embed") === "1";
  }, []);
  const [bootstrapUser, setBootstrapUser] = useState<{ name: string; email: string } | null>(null);
  const [currentPageTitle, setCurrentPageTitle] = useState<string | null>(null);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [widgetOpenSequence, setWidgetOpenSequence] = useState(0);
  const [lastWidgetOpenedAt, setLastWidgetOpenedAt] = useState<number | null>(null);
  const [lastWidgetClosedAt, setLastWidgetClosedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!isEmbeddedMode) {
      return;
    }

    const postReady = () => {
      window.parent?.postMessage(
        {
          source: "cyncly-advisor-iframe",
          type: "ready"
        },
        "*"
      );
    };

    const handleMessage = (event: MessageEvent<BridgeMessage>) => {
      const message = event.data;

      if (!message || message.source !== "cyncly-advisor-widget") {
        return;
      }

      if (message.type === "bootstrap") {
        const payload = (message.payload ?? {}) as EmbeddedBootstrapPayload;
        const nextName = payload.name?.trim() ?? "";
        const nextEmail = payload.email?.trim().toLowerCase() ?? "";

        setBootstrapUser(nextEmail ? { name: nextName, email: nextEmail } : null);
        setCurrentPageTitle(payload.pageTitle?.trim() ?? null);
        setBootstrapReady(true);
        return;
      }

      if (message.type === "widget-opened") {
        const payload = (message.payload ?? {}) as WidgetLifecyclePayload;
        const timestamp = Number(payload.timestamp ?? Date.now());
        setLastWidgetOpenedAt(timestamp);
        setWidgetOpenSequence((current) => current + 1);
        return;
      }

      if (message.type === "widget-closed") {
        const payload = (message.payload ?? {}) as WidgetLifecyclePayload;
        const timestamp = Number(payload.timestamp ?? Date.now());
        setLastWidgetClosedAt(timestamp);
      }
    };

    window.addEventListener("message", handleMessage);
    postReady();
    const readyFrame = window.requestAnimationFrame(postReady);

    return () => {
      window.cancelAnimationFrame(readyFrame);
      window.removeEventListener("message", handleMessage);
    };
  }, [isEmbeddedMode]);

  return {
    isEmbeddedMode,
    bootstrapUser,
    currentPageTitle,
    bootstrapReady,
    widgetOpenSequence,
    lastWidgetOpenedAt,
    lastWidgetClosedAt
  };
}
