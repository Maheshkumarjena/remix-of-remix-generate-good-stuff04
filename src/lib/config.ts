/**
 * Production environment configuration for Campus Service Copilot.
 */

export const config = {
  appName: (import.meta.env["VITE_APP_TITLE"] as string | undefined) ?? "Campus Service Copilot",
  appVersion: "1.0.0",
  apiBaseUrl: (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3000",
  isProduction: import.meta.env.MODE === "production",
  supportEmail: "support@campus.edu",
} as const;

export function getApiUrl(path: string): string {
  const base = config.apiBaseUrl.replace(/\/$/, "");
  const relPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${relPath}`;
}
