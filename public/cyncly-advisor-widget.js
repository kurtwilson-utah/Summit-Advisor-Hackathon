(function () {
  if (window.CynclyAdvisorWidget) {
    return;
  }

  const HOST_STORAGE_KEY = "persist:summit-shell-root";
  const POSITION_STORAGE_KEY = "cyncly-advisor/widget-position/v2";
  const FRAME_SOURCE = "cyncly-advisor-widget";
  const CHILD_SOURCE = "cyncly-advisor-iframe";
  const launcherSize = 56;
  const gutter = 16;
  const panelGap = 12;
  const script = document.currentScript;
  const scriptUrl = script ? new URL(script.src, window.location.href) : new URL(window.location.href);
  const widgetOrigin = scriptUrl.origin;
  const iframeUrl = new URL("/?embed=1", widgetOrigin).toString();

  const state = {
    iframeReady: false,
    iframeLoaded: false,
    isOpen: false,
    isDragging: false,
    didDrag: false,
    pointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    hostSyncTimeoutId: null,
    locationSignature: getLocationSignature(),
    position: loadPosition()
  };

  function initialize() {
    const root = document.createElement("div");
    const launcher = document.createElement("button");
    const panel = document.createElement("div");
    const iframe = document.createElement("iframe");

    root.id = "cyncly-advisor-widget-root";
    Object.assign(root.style, {
      inset: "0",
      pointerEvents: "none",
      position: "fixed",
      zIndex: "2147483000"
    });

    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open Cyncly Advisor");
    launcher.innerHTML = "&#10022;";
    Object.assign(launcher.style, {
      alignItems: "center",
      background: "#6038E8",
      border: "0",
      borderRadius: "999px",
      boxShadow: "0 18px 32px rgba(15, 23, 42, 0.18)",
      color: "#FFFFFF",
      cursor: "grab",
      display: "inline-flex",
      fontFamily: "\"Noto Sans\", sans-serif",
      fontSize: "24px",
      height: launcherSize + "px",
      justifyContent: "center",
      left: "0",
      pointerEvents: "auto",
      position: "fixed",
      top: "0",
      userSelect: "none",
      width: launcherSize + "px"
    });

    Object.assign(panel.style, {
      background: "#FFFFFF",
      border: "1px solid #F2F2F2",
      borderRadius: "24px",
      boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
      display: "none",
      overflow: "hidden",
      pointerEvents: "auto",
      position: "fixed"
    });

    iframe.title = "Cyncly Advisor";
    iframe.src = "about:blank";
    Object.assign(iframe.style, {
      background: "#FFFFFF",
      border: "0",
      display: "block",
      height: "100%",
      width: "100%"
    });

    panel.appendChild(iframe);
    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    window.CynclyAdvisorWidget = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!state.isOpen),
      destroy: () => {
        window.removeEventListener("message", handleMessage);
        window.removeEventListener("resize", handleWindowResize);
        window.removeEventListener("popstate", handleLocationChange);
        window.removeEventListener("hashchange", handleLocationChange);
        document.removeEventListener("keydown", handleKeyDown);
        window.history.pushState = originalPushState;
        window.history.replaceState = originalReplaceState;
        if (state.hostSyncTimeoutId) {
          window.clearTimeout(state.hostSyncTimeoutId);
        }
        hostMutationObserver.disconnect();
        titleObserver.disconnect();
        root.remove();
        delete window.CynclyAdvisorWidget;
      }
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    const hostMutationObserver = new MutationObserver(() => {
      if (!state.isOpen) {
        return;
      }

      if (state.hostSyncTimeoutId) {
        window.clearTimeout(state.hostSyncTimeoutId);
      }

      state.hostSyncTimeoutId = window.setTimeout(() => {
        state.hostSyncTimeoutId = null;
        syncBootstrap();
      }, 300);
    });

    function ensureFrameLoaded() {
      if (state.iframeLoaded) {
        return;
      }

      iframe.src = iframeUrl;
      state.iframeLoaded = true;
    }

    function sendToIframe(type, payload) {
      if (!iframe.contentWindow) {
        return;
      }

      iframe.contentWindow.postMessage(
        {
          source: FRAME_SOURCE,
          type: type,
          payload: payload
        },
        widgetOrigin
      );
    }

    function buildBootstrapPayload() {
      const persistedRoot = safeParse(localStorage.getItem(HOST_STORAGE_KEY));
      const authState = safeParse(persistedRoot && persistedRoot.auth);

      return {
        name: authState && authState.user ? authState.user.name || "" : "",
        email: authState && authState.user ? authState.user.email || "" : "",
        pageTitle: deriveRouteContextValue(),
        hiddenHostPageContext: buildHiddenHostPageContext()
      };
    }

    function syncBootstrap() {
      if (!state.iframeReady) {
        return;
      }

      sendToIframe("bootstrap", buildBootstrapPayload());
    }

    function syncLifecycle(type) {
      if (!state.iframeReady) {
        return;
      }

      sendToIframe(type, {
        timestamp: Date.now()
      });
    }

    function setOpen(nextOpen) {
      ensureFrameLoaded();
      state.isOpen = Boolean(nextOpen);
      panel.style.display = state.isOpen ? "block" : "none";
      launcher.style.cursor = state.isDragging ? "grabbing" : "grab";
      updateLayout();

      if (state.isOpen) {
        syncBootstrap();
        syncLifecycle("widget-opened");
      } else {
        syncLifecycle("widget-closed");
      }
    }

    function updateLayout() {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxX = Math.max(gutter, viewportWidth - launcherSize - gutter);
      const maxY = Math.max(gutter, viewportHeight - launcherSize - gutter);

      state.position.x = clamp(state.position.x, gutter, maxX);
      state.position.y = clamp(state.position.y, gutter, maxY);

      launcher.style.left = state.position.x + "px";
      launcher.style.top = state.position.y + "px";

      const panelWidth = Math.min(392, viewportWidth - gutter * 2);
      const panelHeight = Math.min(720, viewportHeight - gutter * 2);
      const shouldOpenToRight = state.position.x + launcherSize / 2 <= viewportWidth / 2;
      const preferredLeft = shouldOpenToRight
        ? state.position.x + launcherSize + panelGap
        : state.position.x - panelWidth - panelGap;
      const preferredTop = state.position.y + launcherSize - panelHeight;
      const panelLeft = clamp(preferredLeft, gutter, viewportWidth - panelWidth - gutter);
      const panelTop = clamp(preferredTop, gutter, viewportHeight - panelHeight - gutter);

      panel.style.height = panelHeight + "px";
      panel.style.left = panelLeft + "px";
      panel.style.top = panelTop + "px";
      panel.style.width = panelWidth + "px";
    }

    function persistPosition() {
      try {
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(state.position));
      } catch (error) {
        void error;
      }
    }

    function handleLauncherPointerDown(event) {
      state.isDragging = true;
      state.didDrag = false;
      state.pointerId = event.pointerId;
      state.dragOffsetX = event.clientX - state.position.x;
      state.dragOffsetY = event.clientY - state.position.y;
      launcher.style.cursor = "grabbing";
      launcher.setPointerCapture(event.pointerId);
    }

    function handleLauncherPointerMove(event) {
      if (!state.isDragging || event.pointerId !== state.pointerId) {
        return;
      }

      const nextX = event.clientX - state.dragOffsetX;
      const nextY = event.clientY - state.dragOffsetY;

      if (Math.abs(nextX - state.position.x) > 4 || Math.abs(nextY - state.position.y) > 4) {
        state.didDrag = true;
      }

      state.position.x = nextX;
      state.position.y = nextY;
      updateLayout();
    }

    function handleLauncherPointerUp(event) {
      if (event.pointerId !== state.pointerId) {
        return;
      }

      if (launcher.hasPointerCapture(event.pointerId)) {
        launcher.releasePointerCapture(event.pointerId);
      }

      state.isDragging = false;
      state.pointerId = null;
      launcher.style.cursor = "grab";
      persistPosition();

      if (!state.didDrag) {
        setOpen(!state.isOpen);
      }
    }

    function handleMessage(event) {
      if (event.origin !== widgetOrigin) {
        return;
      }

      const message = event.data;

      if (!message || message.source !== CHILD_SOURCE) {
        return;
      }

      if (message.type === "ready") {
        state.iframeReady = true;
        syncBootstrap();

        if (state.isOpen) {
          syncLifecycle("widget-opened");
        }
      }
    }

    function handleWindowResize() {
      updateLayout();
      handleLocationChange();
    }

    function handleLocationChange() {
      const nextLocationSignature = getLocationSignature();

      if (nextLocationSignature === state.locationSignature) {
        return;
      }

      state.locationSignature = nextLocationSignature;
      syncBootstrap();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && state.isOpen) {
        setOpen(false);
      }
    }

    launcher.addEventListener("pointerdown", handleLauncherPointerDown);
    launcher.addEventListener("pointermove", handleLauncherPointerMove);
    launcher.addEventListener("pointerup", handleLauncherPointerUp);
    launcher.addEventListener("pointercancel", handleLauncherPointerUp);
    window.addEventListener("message", handleMessage);
    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    document.addEventListener("keydown", handleKeyDown);
    window.history.pushState = function pushState() {
      const result = originalPushState.apply(this, arguments);
      handleLocationChange();
      return result;
    };
    window.history.replaceState = function replaceState() {
      const result = originalReplaceState.apply(this, arguments);
      handleLocationChange();
      return result;
    };

    const titleObserver = new MutationObserver(() => {
      syncBootstrap();
    });

    const titleElement = document.querySelector("title");
    if (titleElement) {
      titleObserver.observe(titleElement, { childList: true, subtree: true, characterData: true });
    }

    if (document.body) {
      hostMutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    updateLayout();
  }

  function loadPosition() {
    try {
      const serialized = localStorage.getItem(POSITION_STORAGE_KEY);

      if (serialized) {
        const parsed = JSON.parse(serialized);

        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          return parsed;
        }
      }
    } catch (error) {
      void error;
    }

    return defaultPosition();
  }

  function defaultPosition() {
    return {
      x: gutter,
      y: Math.max(gutter, window.innerHeight - launcherSize - gutter)
    };
  }

  function getLocationSignature() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  function deriveRouteContextValue() {
    const pathSegments = window.location.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    const primarySegment = pathSegments[0];

    if (!primarySegment) {
      return "Home";
    }

    return humanizeRouteSegment(primarySegment);
  }

  function humanizeRouteSegment(segment) {
    const decodedSegment = decodeURIComponent(segment)
      .replace(/\?.*$/, "")
      .replace(/#.*/, "")
      .trim();

    if (!decodedSegment) {
      return "Home";
    }

    const separatedSegment = decodedSegment
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ");
    const baseWords = separatedSegment
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) => splitCompoundRouteWord(word));

    return baseWords
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function splitCompoundRouteWord(word) {
    const normalizedWord = word.trim();

    if (!normalizedWord) {
      return [];
    }

    if (/[A-Z]/.test(normalizedWord) || normalizedWord.includes(" ")) {
      return normalizedWord.split(/\s+/).filter(Boolean).map((entry) => entry.toLowerCase());
    }

    const lowerWord = normalizedWord.toLowerCase();
    const knownSegments = [
      "sales",
      "orders",
      "order",
      "purchase",
      "purchasing",
      "proposal",
      "proposals",
      "project",
      "projects",
      "catalog",
      "catalogs",
      "pricing",
      "services",
      "service",
      "contact",
      "contacts",
      "records",
      "record",
      "dashboard",
      "dashboards",
      "reporting",
      "inventory",
      "warehouse",
      "scheduling",
      "installation",
      "roles",
      "role",
      "users",
      "user",
      "taxes",
      "tax",
      "permissions",
      "permission",
      "screen",
      "screens",
      "overview",
      "jobs",
      "job",
      "types",
      "type",
      "design",
      "flex",
      "measure",
      "mobile",
      "customer",
      "customers",
      "communication",
      "communications",
      "financials",
      "financial",
      "accounting",
      "api",
      "apis",
      "integrations",
      "integration",
      "receiving",
      "post",
      "close",
      "profit",
      "general",
      "access",
      "sign",
      "in"
    ];
    const sortedSegments = [...knownSegments].sort((left, right) => right.length - left.length);
    const splitWords = [];
    let cursor = 0;

    while (cursor < lowerWord.length) {
      const remaining = lowerWord.slice(cursor);
      const matchingSegment = sortedSegments.find((segmentPart) => remaining.startsWith(segmentPart));

      if (!matchingSegment) {
        return [lowerWord];
      }

      splitWords.push(matchingSegment);
      cursor += matchingSegment.length;
    }

    return splitWords;
  }

  function buildHiddenHostPageContext() {
    const routeLabel = deriveRouteContextValue();
    const pageClone = document.body ? document.body.cloneNode(true) : null;

    if (!pageClone || !(pageClone instanceof HTMLElement)) {
      return {
        routeLabel: routeLabel,
        url: window.location.href,
        pageTitle: document.title || routeLabel,
        uiText: "",
        domSnapshot: ""
      };
    }

    pageClone.querySelectorAll("script, style, noscript, iframe, canvas, svg").forEach((node) => node.remove());
    pageClone.querySelectorAll("#cyncly-advisor-widget-root").forEach((node) => node.remove());
    pageClone.querySelectorAll("[aria-hidden='true']").forEach((node) => {
      if (node.id !== "cyncly-advisor-widget-root") {
        node.remove();
      }
    });

    const widgetRoot = document.getElementById("cyncly-advisor-widget-root");
    const previousWidgetDisplay = widgetRoot ? widgetRoot.style.display : "";

    if (widgetRoot) {
      widgetRoot.style.display = "none";
    }

    const uiText = normalizeWhitespace(document.body ? document.body.innerText || document.body.textContent || "" : "").slice(0, 6000);

    if (widgetRoot) {
      widgetRoot.style.display = previousWidgetDisplay;
    }

    const domSnapshot = normalizeWhitespace(pageClone.innerHTML || "").slice(0, 12000);

    return {
      routeLabel: routeLabel,
      url: window.location.href,
      pageTitle: document.title || routeLabel,
      uiText: uiText,
      domSnapshot: domSnapshot
    };
  }

  function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function safeParse(value) {
    if (typeof value !== "string") {
      return value && typeof value === "object" ? value : null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      void error;
      return null;
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  if (document.body) {
    initialize();
  } else {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  }
})();
