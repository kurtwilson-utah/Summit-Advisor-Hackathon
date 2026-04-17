import type { ThemeSettings } from "./types";

export const defaultTheme: ThemeSettings = {
  name: "Cyncly Light",
  fontDisplay: '"Noto Sans", "Avenir Next", "Segoe UI", sans-serif',
  fontBody: '"Noto Sans", "Avenir Next", "Segoe UI", sans-serif',
  backgroundCanvas: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceStrong: "#FFFFFF",
  surfaceMuted: "#F8F8F8",
  sidebar: "#FFFFFF",
  border: "#CCCCCC",
  divider: "#F2F2F2",
  textStrong: "#171717",
  textMuted: "#6F6F6F",
  accent: "#1A6CFF",
  accentSoft: "#EDF4FF",
  accentContrast: "#FFFFFF",
  userBubble: "#E7E1FC",
  assistantBubble: "#FFFFFF",
  assistantAvatar: "#6038E8",
  success: "#1E9B57",
  warning: "#B26A00",
  shadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
  bubbleShadow: "0 8px 20px rgba(15, 23, 42, 0.08)"
};

export function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement;
  root.style.setProperty("--font-display", theme.fontDisplay);
  root.style.setProperty("--font-body", theme.fontBody);
  root.style.setProperty("--background-canvas", theme.backgroundCanvas);
  root.style.setProperty("--surface", theme.surface);
  root.style.setProperty("--surface-strong", theme.surfaceStrong);
  root.style.setProperty("--surface-muted", theme.surfaceMuted);
  root.style.setProperty("--sidebar", theme.sidebar);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--divider", theme.divider);
  root.style.setProperty("--text-strong", theme.textStrong);
  root.style.setProperty("--text-muted", theme.textMuted);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-soft", theme.accentSoft);
  root.style.setProperty("--accent-contrast", theme.accentContrast);
  root.style.setProperty("--user-bubble", theme.userBubble);
  root.style.setProperty("--assistant-bubble", theme.assistantBubble);
  root.style.setProperty("--assistant-avatar", theme.assistantAvatar);
  root.style.setProperty("--success", theme.success);
  root.style.setProperty("--warning", theme.warning);
  root.style.setProperty("--shadow", theme.shadow);
  root.style.setProperty("--bubble-shadow", theme.bubbleShadow);
}
