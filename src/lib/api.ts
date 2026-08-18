/**
 * Campus Service Copilot API client.
 * Talks to the NestJS backend (default http://localhost:3000).
 * Cookie auth first (credentials: include), with in-memory bearer fallback
 * and a single automatic refresh retry on 401.
 */

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  code: string | undefined;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; skipRefresh?: boolean };

async function raw(path: string, options: Options = {}): Promise<Response> {
  const { body, skipRefresh: _skip, headers, ...rest } = options;
  return fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * Demo mode: when the backend cannot be reached we transparently serve the
 * in-memory demo dataset so every screen stays explorable.
 */
let demoMode = false;
const demoListeners = new Set<() => void>();

export function isDemoMode() {
  return demoMode;
}
export function onDemoModeChange(listener: () => void) {
  demoListeners.add(listener);
  return () => demoListeners.delete(listener);
}
function enableDemoMode() {
  if (!demoMode) {
    demoMode = true;
    demoListeners.forEach((l) => l());
  }
}

async function demo<T>(path: string, options: Options): Promise<T> {
  const { mockRequest, MockNotFound } = await import("./mock-api");
  try {
    return await mockRequest<T>(
      path,
      (options.method as string | undefined) ?? "GET",
      options.body as Record<string, unknown> | undefined,
    );
  } catch (err) {
    if (err instanceof MockNotFound) throw new ApiError(err.message, 404, "DEMO_NOT_FOUND");
    throw new ApiError(err instanceof Error ? err.message : "Demo request failed", 400);
  }
}

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  if (demoMode) return demo<T>(path, options);

  let res: Response;
  try {
    res = await raw(path, options);
  } catch {
    enableDemoMode();
    return demo<T>(path, options);
  }

  if (res.status === 401 && !options.skipRefresh && !path.startsWith("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, { ...options, skipRefresh: true });
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const payload = data as { message?: string | string[]; code?: string } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : (payload?.message ?? `Request failed (${res.status})`);
    throw new ApiError(message, res.status, payload?.code);
  }

  return data as T;
}


function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let refreshing: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await raw("/auth/refresh", { method: "POST", skipRefresh: true });
        if (!res.ok) return false;
        const data = (await res.json().catch(() => null)) as { access_token?: string } | null;
        if (data?.access_token) setAccessToken(data.access_token);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
