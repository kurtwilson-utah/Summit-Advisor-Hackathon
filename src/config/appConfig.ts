export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  appName: import.meta.env.VITE_APP_NAME ?? "Cyncly Advisor",
  useMockBackend: String(import.meta.env.VITE_USE_MOCK_BACKEND ?? "false") === "true"
};
