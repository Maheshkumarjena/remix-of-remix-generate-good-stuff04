/**
 * Campus Service Copilot API client.
 * Talks to the NestJS backend (default http://localhost:3000).
 * Cookie auth first (credentials: include), with in-memory bearer fallback
 * and a single automatic refresh retry on 401.
 */

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3000";

let accessToken: string | null = null;

export interface PersonaHeaders {
  userId?: string;
  userRole?: string;
  departmentId?: string;
}

let activePersona: PersonaHeaders | null = null;

export function setPersonaHeaders(persona: PersonaHeaders | null) {
  activePersona = persona;
}
export function getPersonaHeaders() {
  return activePersona;
}

export const PRESET_PERSONAS = [
  {
    id: "student-paid",
    name: "Aditi Sharma",
    role: "student",
    label: "Aditi Sharma (Student · 3rd Yr CSE · Fee Paid)",
    headers: {
      userId: "22222222-2222-4222-8222-222222222222",
      userRole: "student",
      departmentId: "aaaaaaaa-aaaa-4aaa-8aaa-111111111111",
    },
  },
  {
    id: "student-unpaid",
    name: "Rohit Panda",
    role: "student",
    label: "Rohit Panda (Student · 2nd Yr ECE · Fee Unpaid)",
    headers: {
      userId: "44444444-4444-4444-8444-444444444444",
      userRole: "student",
      departmentId: "aaaaaaaa-aaaa-4aaa-8aaa-222222222222",
    },
  },
  {
    id: "staff-acad",
    name: "Priya Das",
    role: "staff",
    label: "Priya Das (Academic Staff · Approver)",
    headers: {
      userId: "33333333-3333-4333-8333-333333333333",
      userRole: "staff",
      departmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    },
  },
  {
    id: "faculty-lab",
    name: "Dr. R. Nayak",
    role: "lab_incharge",
    label: "Dr. R. Nayak (Faculty · Lab In-Charge)",
    headers: {
      userId: "55555555-1111-4555-8555-111111111111",
      userRole: "lab_incharge",
      departmentId: "aaaaaaaa-aaaa-4aaa-8aaa-111111111111",
    },
  },
];

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
      ...(activePersona?.userId ? { "x-user-id": activePersona.userId } : {}),
      ...(activePersona?.userRole ? { "x-user-role": activePersona.userRole } : {}),
      ...(activePersona?.departmentId ? { "x-department-id": activePersona.departmentId } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await raw(path, options);
  } catch {
    throw new ApiError(
      "Cannot reach backend API. Check server status and CORS/cookie configuration.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (res.status === 401 && !options.skipRefresh && !path.startsWith("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, { ...options, skipRefresh: true });
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const payload = data as { message?: string | string[]; error?: string; code?: string } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : (payload?.message ?? payload?.error ?? `Request failed (${res.status})`);
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
