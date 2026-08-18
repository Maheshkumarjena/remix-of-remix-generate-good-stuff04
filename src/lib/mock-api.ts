/**
 * In-memory demo backend.
 *
 * Used automatically when the NestJS API at VITE_API_BASE_URL cannot be reached,
 * so the whole product stays explorable without running the backend.
 * Sign in with any password; the role is inferred from the email
 * (admin@..., staff@..., warden@..., lab@..., otherwise student).
 */

import type {
  Approval,
  AuditEvent,
  Grievance,
  KbChunk,
  KbDocument,
  LabBooking,
  LabResource,
  Notification,
  PolicyConflict,
  Role,
  ServiceRequest,
  User,
} from "./types";

export const MOCK_MODE_MESSAGE = "Demo mode - showing sample data (backend offline)";

const SESSION_KEY = "csc.demo.session";

let idCounter = 1000;
const uid = (prefix: string) =>
  `${prefix}-${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const iso = (offsetMinutes: number) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();

function roleFor(email: string): Role {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.startsWith("admin")) return "admin";
  if (local.startsWith("warden")) return "warden";
  if (local.startsWith("lab")) return "lab_incharge";
  if (local.startsWith("staff")) return "staff";
  return "student";
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "user";
  return local
    .split(/[._-]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

let currentUser: User | null = null;

function loadSession(): User | null {
  if (currentUser) return currentUser;
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    currentUser = raw ? (JSON.parse(raw) as User) : null;
  } catch {
    currentUser = null;
  }
  return currentUser;
}

function saveSession(user: User | null) {
  currentUser = user;
  if (typeof localStorage === "undefined") return;
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

/* ------------------------------- seed data ------------------------------- */

const requests: ServiceRequest[] = [
  {
    id: "REQ-2481",
    type: "bonafide_certificate",
    status: "pending_approval",
    title: "Bonafide certificate for scholarship",
    description: "Needed for the state merit scholarship portal, deadline Friday.",
    department: "Registrar",
    sla_due_at: iso(60 * 20),
    created_at: iso(-60 * 5),
    updated_at: iso(-40),
    timeline: [
      { status: "created", actor: "Aarav Sharma", created_at: iso(-60 * 5) },
      {
        status: "policy_checked",
        actor: "Copilot",
        note: "Matched Registrar Handbook 4.2",
        created_at: iso(-60 * 4),
      },
      {
        status: "pending_approval",
        actor: "Copilot",
        note: "High-risk action: document issuance",
        created_at: iso(-40),
      },
    ],
  },
  {
    id: "REQ-2477",
    type: "hostel_room_change",
    status: "in_progress",
    title: "Room change request - Block C",
    description: "Persistent water leakage in room C-214.",
    department: "Hostel",
    sla_due_at: iso(60 * 30),
    created_at: iso(-60 * 26),
    updated_at: iso(-60 * 2),
    timeline: [
      { status: "created", actor: "Meera Iyer", created_at: iso(-60 * 26) },
      { status: "assigned", actor: "Warden Rao", created_at: iso(-60 * 20) },
      {
        status: "in_progress",
        actor: "Maintenance",
        note: "Inspection scheduled",
        created_at: iso(-60 * 2),
      },
    ],
  },
  {
    id: "REQ-2470",
    type: "transcript",
    status: "completed",
    title: "Official transcript (2 copies)",
    department: "Examinations",
    created_at: iso(-60 * 96),
    updated_at: iso(-60 * 50),
    timeline: [
      { status: "created", created_at: iso(-60 * 96) },
      { status: "approved", actor: "Dr. Kapoor", created_at: iso(-60 * 70) },
      {
        status: "completed",
        actor: "Examinations",
        note: "Dispatched by courier",
        created_at: iso(-60 * 50),
      },
    ],
  },
  {
    id: "REQ-2465",
    type: "fee_receipt",
    status: "open",
    title: "Duplicate fee receipt for FY25",
    department: "Accounts",
    sla_due_at: iso(-60 * 3),
    created_at: iso(-60 * 40),
    updated_at: iso(-60 * 12),
    timeline: [{ status: "created", created_at: iso(-60 * 40) }],
  },
];

const approvals: Approval[] = [
  {
    id: "APR-731",
    status: "pending",
    risk_level: "high",
    tool_name: "issue_document",
    tool_args: { document: "bonafide_certificate", request_id: "REQ-2481" },
    reasoning:
      "Student is in good standing and enrolment is active. Issuance requires staff sign-off per Registrar Handbook 4.2.",
    request_id: "REQ-2481",
    requester_name: "Aarav Sharma",
    original_request: "I need a bonafide certificate for a scholarship application.",
    cited_chunk_ids: ["CHK-1"],
    evidence: [
      {
        document_id: "KB-Registrar-Handbook",
        version: "v3.1",
        page: 12,
        clause: "4.2",
        similarity: 0.91,
        text: "Bonafide certificates are issued to enrolled students after verification by the Registrar's office.",
      },
    ],
    created_at: iso(-40),
  },
  {
    id: "APR-728",
    status: "pending",
    risk_level: "medium",
    tool_name: "override_lab_booking",
    tool_args: { resource_id: "LAB-2", slot: "Wed 14:00" },
    reasoning:
      "Requested slot overlaps a scheduled lab session; override needs lab in-charge approval.",
    requester_name: "Prof. Nandini",
    original_request: "Book Robotics Lab on Wednesday afternoon for CS402 makeup class.",
    created_at: iso(-120),
  },
  {
    id: "APR-719",
    status: "approved",
    risk_level: "low",
    tool_name: "update_request_status",
    reasoning: "Routine status update after maintenance inspection.",
    request_id: "REQ-2477",
    requester_name: "Maintenance",
    created_at: iso(-60 * 6),
  },
];

const notifications: Notification[] = [
  {
    id: "NTF-91",
    title: "Approval needed",
    message: "Bonafide certificate issuance for REQ-2481 is waiting on staff sign-off.",
    read: false,
    deepLink: "/staff/approvals",
    created_at: iso(-35),
  },
  {
    id: "NTF-90",
    title: "SLA at risk",
    message: "REQ-2465 (duplicate fee receipt) has breached its 24h response target.",
    read: false,
    deepLink: "/requests/REQ-2465",
    created_at: iso(-180),
  },
  {
    id: "NTF-84",
    title: "Request completed",
    message: "Your transcript request REQ-2470 was dispatched by courier.",
    read: true,
    deepLink: "/requests/REQ-2470",
    created_at: iso(-60 * 50),
  },
];

const grievances: Grievance[] = [
  {
    id: "GRV-312",
    category: "hostel",
    description: "Mess food quality has dropped sharply over the last two weeks in Block C.",
    status: "escalated",
    escalation_level: 2,
    is_anonymous: true,
    created_at: iso(-60 * 30),
  },
  {
    id: "GRV-308",
    category: "academics",
    description: "Lab practical marks for CS302 were not published on the portal.",
    status: "in_progress",
    escalation_level: 1,
    created_at: iso(-60 * 70),
  },
  {
    id: "GRV-301",
    category: "infrastructure",
    description: "Library reading room air conditioning not functional.",
    status: "resolved",
    escalation_level: 1,
    created_at: iso(-60 * 200),
  },
];

const labResources: LabResource[] = [
  { id: "LAB-1", name: "Computing Lab A", location: "Block B, Floor 2", capacity: 60 },
  { id: "LAB-2", name: "Robotics Lab", location: "Block D, Floor 1", capacity: 24 },
  { id: "LAB-3", name: "Electronics Lab", location: "Block A, Floor 3", capacity: 40 },
];

const today = new Date().toISOString().slice(0, 10);
const labBookings: LabBooking[] = [
  {
    id: "BKG-55",
    resource_id: "LAB-1",
    resource_name: "Computing Lab A",
    start_time: today + "T09:00:00.000Z",
    end_time: today + "T11:00:00.000Z",
    course_code: "CS201",
    faculty_reference: "Dr. Kapoor",
    status: "confirmed",
  },
  {
    id: "BKG-56",
    resource_id: "LAB-2",
    resource_name: "Robotics Lab",
    start_time: today + "T14:00:00.000Z",
    end_time: today + "T16:00:00.000Z",
    course_code: "CS402",
    faculty_reference: "Prof. Nandini",
    status: "pending",
  },
];

const kbDocs: KbDocument[] = [
  {
    id: "KB-Registrar-Handbook",
    title: "Registrar Handbook",
    version: "v3.1",
    status: "indexed",
    chunk_count: 148,
    updated_at: iso(-60 * 200),
  },
  {
    id: "KB-Hostel-Rules",
    title: "Hostel Rules & Room Allotment Policy",
    version: "v2.4",
    status: "indexed",
    chunk_count: 96,
    updated_at: iso(-60 * 90),
  },
  {
    id: "KB-Lab-Safety",
    title: "Laboratory Safety and Booking Guidelines",
    version: "v1.8",
    status: "indexed",
    chunk_count: 61,
    updated_at: iso(-60 * 20),
  },
  {
    id: "KB-Grievance-Charter",
    title: "Student Grievance Redressal Charter",
    version: "v1.2",
    status: "processing",
    chunk_count: 0,
    updated_at: iso(-15),
  },
];

const kbChunks: KbChunk[] = [
  {
    chunk_id: "CHK-1",
    document_id: "KB-Registrar-Handbook",
    version: "v3.1",
    page: 12,
    clause: "4.2",
    text: "Bonafide certificates are issued to enrolled students after verification by the Registrar's office. Processing time is two working days.",
  },
  {
    chunk_id: "CHK-2",
    document_id: "KB-Registrar-Handbook",
    version: "v3.1",
    page: 14,
    clause: "5.1",
    text: "Official transcripts require payment of the prescribed fee and are dispatched by courier within five working days.",
  },
  {
    chunk_id: "CHK-3",
    document_id: "KB-Hostel-Rules",
    version: "v2.4",
    page: 7,
    clause: "3.4",
    text: "Room change requests are considered on medical grounds, maintenance defects, or documented roommate conflict, and need warden approval.",
  },
  {
    chunk_id: "CHK-4",
    document_id: "KB-Lab-Safety",
    version: "v1.8",
    page: 3,
    clause: "2.2",
    text: "Lab slots may be booked up to 14 days in advance. Overlapping bookings require lab in-charge approval.",
  },
  {
    chunk_id: "CHK-5",
    document_id: "KB-Grievance-Charter",
    version: "v1.2",
    page: 2,
    clause: "1.3",
    text: "Grievances unresolved within seven days escalate to the next authority level automatically.",
  },
];

const auditEvents: AuditEvent[] = [
  {
    id: "aud-9f3a71c204",
    entity_type: "approval",
    entity_id: "APR-731",
    action: "approval_requested",
    actor_id: "usr-copilot-agent",
    hash: "5f2c9a1d77b34e6f8c0a1b2d3e4f50617283940a5b6c7d8e9f0a1b2c3d4e5f60",
    prev_hash: "0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9",
    created_at: iso(-40),
  },
  {
    id: "aud-8b21d0ea55",
    entity_type: "request",
    entity_id: "REQ-2481",
    action: "policy_checked",
    actor_id: "usr-copilot-agent",
    hash: "0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9",
    created_at: iso(-60 * 4),
  },
  {
    id: "aud-7c19aa34e1",
    entity_type: "kb_document",
    entity_id: "KB-Grievance-Charter",
    action: "document_ingested",
    actor_id: "usr-admin-1",
    hash: "9e8d7c6b5a4938271605f4e3d2c1b0a998877665544332211aabbccddeeff001",
    created_at: iso(-15),
  },
  {
    id: "aud-6d08bb1290",
    entity_type: "approval",
    entity_id: "APR-719",
    action: "approval_granted",
    actor_id: "usr-staff-3",
    hash: "112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
    created_at: iso(-60 * 6),
  },
];

const policyConflicts: PolicyConflict[] = [
  {
    id: "PCF-14",
    summary:
      "Registrar Handbook 5.1 promises transcripts in 5 working days, while Examinations Circular 2026 states 10 working days.",
    document_a: { id: "KB-Registrar-Handbook", clause: "5.1" },
    document_b: { id: "KB-Exam-Circular-2026", clause: "2.3" },
    detected_at: iso(-60 * 12),
  },
  {
    id: "PCF-11",
    summary:
      "Hostel Rules 3.4 requires warden approval for room changes; Hostel Annexe A allows self-service swaps within a block.",
    document_a: { id: "KB-Hostel-Rules", clause: "3.4" },
    document_b: { id: "KB-Hostel-Annexe-A", clause: "1.1" },
    detected_at: iso(-60 * 60),
  },
];

/* ------------------------------ agent session ----------------------------- */

interface AgentMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  cited_chunk_ids?: string[];
  created_at?: string;
}

const sessions = new Map<string, AgentMsg[]>();

function agentReply(text: string): AgentMsg {
  const q = text.toLowerCase();
  let content =
    "I can help with certificates, hostel and lab matters, and grievances. Tell me what you need and I will check campus policy first.";
  let cited: string[] = [];

  if (q.includes("bonafide") || q.includes("certificate")) {
    content =
      "Bonafide certificates are issued to enrolled students after Registrar verification, usually within two working days. I have drafted the request - issuance is high-risk, so it now waits for staff approval (APR-731).";
    cited = ["CHK-1"];
  } else if (q.includes("transcript")) {
    content =
      "Official transcripts need the prescribed fee and are dispatched by courier within five working days. Note: a policy conflict is open on this timeline (PCF-14).";
    cited = ["CHK-2"];
  } else if (q.includes("hostel") || q.includes("room")) {
    content =
      "Room changes are allowed on medical grounds, maintenance defects, or documented roommate conflict, and require warden approval. I can raise the request with your reason attached.";
    cited = ["CHK-3"];
  } else if (q.includes("lab") || q.includes("book")) {
    content =
      "Lab slots can be booked up to 14 days ahead. Your requested slot overlaps a scheduled session, so it needs lab in-charge approval before it is confirmed.";
    cited = ["CHK-4"];
  } else if (q.includes("grievance") || q.includes("complaint")) {
    content =
      "You can file a grievance anonymously. If it stays unresolved for seven days it escalates automatically to the next authority level.";
    cited = ["CHK-5"];
  }

  return {
    id: uid("msg"),
    role: "assistant",
    content,
    cited_chunk_ids: cited,
    created_at: new Date().toISOString(),
  };
}

/* -------------------------------- routing -------------------------------- */

function page<T>(items: T[], search: URLSearchParams) {
  const limit = Number(search.get("limit") ?? 20);
  const p = Number(search.get("page") ?? 1);
  const start = (p - 1) * limit;
  return { data: items.slice(start, start + limit), total: items.length, page: p, limit };
}

export class MockNotFound extends Error {}

/** Handles one request against the in-memory demo backend. */
export async function mockRequest<T>(
  path: string,
  method: string,
  body: Record<string, unknown> | undefined,
): Promise<T> {
  const [rawPath, rawQuery = ""] = path.split("?");
  const url = rawPath ?? "/";
  const search = new URLSearchParams(rawQuery);
  const m = method.toUpperCase();
  const seg = url.split("/").filter(Boolean);
  const ok = { ok: true } as unknown as T;

  await new Promise((r) => setTimeout(r, 160));

  // ---- auth
  if (url === "/auth/login" && m === "POST") {
    const email = String(body?.["email"] ?? "").trim();
    if (!email || !body?.["password"]) throw new Error("Email and password are required");
    const user: User = {
      id: uid("usr"),
      name: nameFromEmail(email),
      email,
      role: roleFor(email),
      department: "Registrar",
      preferred_language: "en",
      notification_preferences: { email: true, push: true, sms: false },
    };
    saveSession(user);
    return { user, access_token: "demo." + user.id } as unknown as T;
  }
  if (url === "/auth/register" && m === "POST") {
    const user: User = {
      id: uid("usr"),
      name: String(body?.["name"] ?? "Demo User"),
      email: String(body?.["email"] ?? "demo@campus.edu"),
      role: (body?.["role"] as Role) ?? "student",
      department: (body?.["department_id"] as string) ?? (body?.["department"] as string) ?? null,
      preferred_language: (body?.["preferred_language"] as string) ?? "en",
      notification_preferences: { email: true, push: true, sms: false },
    };
    return { user } as unknown as T;
  }
  if (url === "/auth/logout") {
    saveSession(null);
    return ok;
  }
  if (url === "/auth/refresh") throw new MockNotFound("No demo session");

  if (url === "/users/me") {
    const user = loadSession();
    if (!user) throw new MockNotFound("Not signed in");
    if (m === "PATCH" || m === "PUT") {
      const next = {
        ...user,
        ...(body as Partial<User>),
        notification_preferences:
          ((body?.["notification_prefs"] as Record<string, boolean> | undefined) ??
            (body?.["notification_preferences"] as Record<string, boolean> | undefined) ??
            user.notification_preferences),
      };
      saveSession(next);
      return next as unknown as T;
    }
    return user as unknown as T;
  }

  // ---- requests
  if (seg[0] === "requests") {
    if (seg.length === 1 && m === "GET") {
      const status = search.get("status");
      const list = status ? requests.filter((r) => r.status === status) : requests;
      return page(list, search) as unknown as T;
    }
    if (seg.length === 1 && m === "POST") {
      const req: ServiceRequest = {
        id: uid("REQ"),
        type: String(body?.["request_type"] ?? body?.["type"] ?? "general"),
        status: "open",
        title: String(body?.["title"] ?? body?.["request_type"] ?? "New request"),
        description: String(body?.["description"] ?? ""),
        department: (body?.["department_id"] as string) ?? (body?.["department"] as string) ?? "Registrar",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        timeline: [{ status: "created", created_at: new Date().toISOString() }],
      };
      requests.unshift(req);
      return req as unknown as T;
    }
    const req = requests.find((r) => r.id === seg[1]);
    if (!req) throw new MockNotFound("Request not found");
    if (seg[2] === "status" && (m === "PATCH" || m === "POST")) {
      req.status = String(body?.["status"] ?? req.status);
      req.updated_at = new Date().toISOString();
      req.timeline = [...(req.timeline ?? []), { status: req.status, created_at: req.updated_at }];
      return req as unknown as T;
    }
    return req as unknown as T;
  }

  // ---- approvals
  if (seg[0] === "approvals") {
    if (seg.length === 1) return page(approvals, search) as unknown as T;
    const approval = approvals.find((a) => a.id === seg[1]);
    if (!approval) throw new MockNotFound("Approval not found");
    if (seg[2] === "approve") approval.status = "approved";
    else if (seg[2] === "reject") approval.status = "rejected";
    return approval as unknown as T;
  }

  // ---- notifications
  if (seg[0] === "notifications") {
    if (seg[1] === "mark-read") {
      const ids =
        ((body?.["ids"] as string[] | undefined) ??
          (body?.["notification_ids"] as string[] | undefined) ??
          []);
      notifications.forEach((n) => {
        if (ids.length === 0 || ids.includes(n.id)) n.read = true;
      });
      return ok;
    }
    const unread = search.get("unread_only") === "true";
    const list = unread ? notifications.filter((n) => !n.read) : notifications;
    return page(list, search) as unknown as T;
  }

  // ---- grievances
  if (seg[0] === "grievances") {
    if (seg.length >= 2) {
      const grievance = grievances.find((g) => g.id === seg[1]);
      if (!grievance) throw new MockNotFound("Grievance not found");
      if (seg[2] === "escalate" && m === "POST") {
        const level = Number(grievance.escalation_level ?? 1);
        grievance.escalation_level = level + 1;
        grievance.status = "escalated";
        return {
          id: grievance.id,
          escalation_level: grievance.escalation_level,
          escalated_at: new Date().toISOString(),
        } as unknown as T;
      }
      return {
        ...grievance,
        escalation_history: [
          {
            escalation_level: grievance.escalation_level ?? 1,
            changed_at: grievance.created_at ?? new Date().toISOString(),
          },
        ],
      } as unknown as T;
    }
    if (m === "POST") {
      const g: Grievance = {
        id: uid("GRV"),
        category: String(body?.["category"] ?? "general"),
        description: String(body?.["description"] ?? ""),
        status: "open",
        escalation_level: 1,
        is_anonymous: Boolean(body?.["is_anonymous"]),
        created_at: new Date().toISOString(),
      };
      grievances.unshift(g);
      return g as unknown as T;
    }
    const status = search.get("status");
    const list = status ? grievances.filter((g) => g.status === status) : grievances;
    return page(list, search) as unknown as T;
  }

  // ---- labs
  if (url.startsWith("/lab-resources")) return labResources as unknown as T;
  if (seg[0] === "lab-bookings") {
    if (m === "POST") {
      const resource = labResources.find((r) => r.id === body?.["resource_id"]);
      const booking: LabBooking = {
        id: uid("BKG"),
        resource_id: String(body?.["resource_id"] ?? "LAB-1"),
        resource_name: resource?.name ?? "Lab",
        start_time: String(body?.["start_time"] ?? new Date().toISOString()),
        end_time: String(body?.["end_time"] ?? new Date().toISOString()),
        course_code: String(body?.["course_code"] ?? ""),
        faculty_reference: String(body?.["faculty_ref"] ?? body?.["faculty_reference"] ?? ""),
        status: "pending",
      };
      labBookings.push(booking);
      return booking as unknown as T;
    }
    if (m === "DELETE") {
      const i = labBookings.findIndex((b) => b.id === seg[1]);
      if (i >= 0) labBookings.splice(i, 1);
      return ok;
    }
    const resourceId = search.get("resource_id");
    const list = resourceId ? labBookings.filter((b) => b.resource_id === resourceId) : labBookings;
    return list as unknown as T;
  }

  // ---- knowledge base
  if (seg[0] === "kb") {
    const kbMode = seg[1] === "documents" ? 2 : 1;
    const kbAction = seg[kbMode];
    const kbDocId = seg[kbMode];

    if (seg[1] === "search") {
      const q = String(body?.["query"] ?? search.get("q") ?? "").toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      const limit = Number(body?.["top_k"] ?? body?.["limit"] ?? 5);
      const scored = kbChunks
        .map((c) => {
          const text = (c.text ?? "").toLowerCase();
          const hits = terms.filter((t) => text.includes(t)).length;
          const similarity = terms.length ? Math.min(0.98, 0.35 + (hits / terms.length) * 0.6) : 0.5;
          return { ...c, similarity };
        })
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
        .slice(0, limit > 0 ? limit : 5);
      return { data: scored } as unknown as T;
    }
    if ((seg.length === 1 || (seg[1] === "documents" && seg.length === 2)) && m === "POST") {
      const content = String(body?.["content"] ?? "");
      const doc: KbDocument = {
        id: uid("KB"),
        title: String(body?.["title"] ?? "Untitled document"),
        version: String(body?.["version"] ?? "v1.0"),
        status: "indexed",
        chunk_count: 0,
        updated_at: new Date().toISOString(),
      };
      const paras = content
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 20)
        .slice(0, 12);
      paras.forEach((p, i) => {
        kbChunks.push({
          chunk_id: uid("CHK"),
          document_id: doc.id,
          version: doc.version ?? "v1.0",
          page: i + 1,
          text: p.slice(0, 400),
        });
      });
      doc.chunk_count = Math.max(paras.length, 1);

      kbDocs.unshift(doc);
      auditEvents.unshift({
        id: uid("aud"),
        entity_type: "kb_document",
        entity_id: doc.id,
        action: "document_ingested",
        actor_id: loadSession()?.id ?? "usr-demo",
        hash: uid("hash").replace(/-/g, "").repeat(3),
        created_at: new Date().toISOString(),
      });
      return doc as unknown as T;
    }
    if (m === "DELETE" && ((seg.length > 1 && seg[1] !== "documents") || seg.length > 2)) {
      const i = kbDocs.findIndex((d) => d.id === (seg[1] === "documents" ? seg[2] : seg[1]));
      if (i >= 0) kbDocs.splice(i, 1);
      return ok;
    }
    return page(kbDocs, search) as unknown as T;
  }

  // ---- admin analytics
  if (seg[0] === "admin" && seg[1] === "analytics") {
    if (seg[2] === "requests-summary") {
      const byTypeMap = new Map<string, number>();
      const byStatusMap = new Map<string, number>();
      requests.forEach((r) => {
        byTypeMap.set(r.type, (byTypeMap.get(r.type) ?? 0) + 1);
        byStatusMap.set(r.status, (byStatusMap.get(r.status) ?? 0) + 1);
      });
      return {
        by_type: Array.from(byTypeMap.entries()).map(([request_type, count]) => ({ request_type, count })),
        by_status: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
      } as unknown as T;
    }

    if (seg[2] === "resolution-time") {
      return {
        points: [
          { date: "2026-08-15", avg_resolution_hours: 1.8 },
          { date: "2026-08-16", avg_resolution_hours: 1.5 },
          { date: "2026-08-17", avg_resolution_hours: 1.25 },
        ],
      } as unknown as T;
    }

    if (seg[2] === "bottlenecks") {
      return {
        items: [
          {
            department: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            step_name: "Issue bonafide certificate",
            overdue_count: 1,
          },
        ],
      } as unknown as T;
    }

    if (seg[2] === "policy-conflicts") {
      return page(policyConflicts, search) as unknown as T;
    }
  }

  // ---- audit / policy
  if (seg[0] === "audit") {
    if (seg[1] === "search") {
      const entityType = search.get("entity_type")?.toLowerCase() ?? "";
      const action = search.get("action")?.toLowerCase() ?? "";
      const filtered = auditEvents.filter((event) => {
        const entityOk = !entityType || event.entity_type.toLowerCase().includes(entityType);
        const actionOk = !action || event.action.toLowerCase().includes(action);
        return entityOk && actionOk;
      });
      return page(filtered, search) as unknown as T;
    }
    if (seg[1] === "verify" && seg[2] && seg[3]) {
      const hasEntity = auditEvents.some((event) => event.entity_type === seg[2] && event.entity_id === seg[3]);
      return { intact: hasEntity } as unknown as T;
    }
    if (seg.length >= 3) {
      const entityEvents = auditEvents.filter((event) => event.entity_type === seg[1] && event.entity_id === seg[2]);
      return entityEvents as unknown as T;
    }
    return page(auditEvents, search) as unknown as T;
  }
  if (seg[0] === "policy-conflicts") return page(policyConflicts, search) as unknown as T;

  // ---- agent
  if (seg[0] === "agent" && seg[1] === "session") {
    if (seg.length === 2 && m === "POST") {
      const id = uid("SES");
      sessions.set(id, [
        {
          id: uid("msg"),
          role: "assistant",
          content:
            "Hi! I am the Campus Copilot. Ask me about certificates, hostel matters, lab bookings or grievances - I answer from campus policy and cite the clause.",
          created_at: new Date().toISOString(),
        },
      ]);
      return { id, session_id: id } as unknown as T;
    }
    const id = seg[2] ?? "";
    const messages = sessions.get(id) ?? [];
    if (seg[3] === "message" && m === "POST") {
      const text = String(body?.["content"] ?? body?.["message"] ?? "");
      messages.push({
        id: uid("msg"),
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      });
      messages.push(agentReply(text));
      sessions.set(id, messages);
      return { accepted: true } as unknown as T;
    }
    if (seg[3] === "plan") {
      return {
        data: [
          {
            id: "P1",
            title: "Understand request",
            status: "completed",
            tool: "classify_intent",
            risk_level: "low",
          },
          {
            id: "P2",
            title: "Retrieve campus policy",
            status: "completed",
            tool: "kb_search",
            risk_level: "low",
          },
          {
            id: "P3",
            title: "Create service request",
            status: "in_progress",
            tool: "create_request",
            risk_level: "medium",
          },
          {
            id: "P4",
            title: "Issue document",
            status: "pending",
            tool: "issue_document",
            risk_level: "high",
          },
        ],
      } as unknown as T;
    }
    return { id, messages } as unknown as T;
  }

  throw new MockNotFound("No demo data for " + m + " " + url);
}
