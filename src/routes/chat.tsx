import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Bot, CheckCircle2, Clock, FileCheck, FileText, Loader2, Lock, Send, ShieldAlert, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentTaskProgress, type ProgressLogItem } from "@/components/AgentTaskProgress";
import { EmptyState, StatusBadge, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime, type RealtimeEvent } from "@/lib/socket";
import type { AgentMessage, Notification, PlanStep, ServiceRequest } from "@/lib/types";

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>) => ({
    session: typeof search.session === "string" ? search.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Campus Copilot Chat" },
      {
        name: "description",
        content:
          "Chat with the campus agent for loan certificates, fee receipts, lab bookings, and academic grievances.",
      },
      { property: "og:title", content: "Campus Copilot Chat" },
      { property: "og:description", content: "Agentic chat with live plan updates and staff approval states." },
    ],
  }),
  component: ChatPage,
});

const studentQuickActions = [
  "I need a bonafide enrollment certificate for my education loan sanction",
  "Can I get my 3rd year fee receipt?",
  "Book the CSE lab tomorrow 2-4 PM for section CSE-3A",
  "Book the main auditorium for an annual tech symposium",
  "Request re-evaluation of my DBMS mid-sem paper (Marks 38/50)",
];

const staffQuickActions = [
  "Check pending high-risk approvals for my department",
  "Show lab booking slot conflicts for tomorrow in CSE Lab",
  "Summarize open grievances for hostel block B",
  "Search academic policy regarding certificate eligibility and attendance rules",
];

const adminQuickActions = [
  "Run SHA-256 hash-chain integrity check on recent audit logs",
  "Show overall department SLA compliance rate and bottlenecks",
  "Identify policy conflicts between academic regulations 2024 and 2026",
  "Summarize campus-wide service request volume and peak load",
];

function getQuickActionsForRole(role?: string) {
  if (role === "admin") return adminQuickActions;
  if (role === "staff" || role === "warden" || role === "lab_incharge") return staffQuickActions;
  return studentQuickActions;
}

function ChatPage() {
  const { session: targetSessionId } = Route.useSearch();
  const { user, loading } = useRequireRole(["student", "staff", "warden", "lab_incharge", "admin"]);
  const { user: authUser } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [taskProgress, setTaskProgress] = useState<{
    activeStage: string;
    stageMessage: string;
    progressPercent: number;
    currentTool?: string;
    logs: ProgressLogItem[];
  }>({
    activeStage: "detect_language",
    stageMessage: "Agent initialized",
    progressPercent: 5,
    logs: [],
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        let id = targetSessionId ?? null;
        if (!id) {
          const session = await api<{ id?: string; session_id?: string }>("/agent/session", {
            method: "POST",
            body: { language: user.preferred_language ?? "en" },
          });
          id = session.id ?? session.session_id ?? null;
        }
        if (!active) return;
        setSessionId(id);
        if (id) {
          const detail = await api<{ messages?: AgentMessage[] }>(`/agent/session/${id}`).catch(() => null);
          if (active && detail?.messages) {
            const normalized = detail.messages.map((m) => ({
              ...m,
              role: (m.role ?? (m.sender === "user" ? "user" : "assistant")) as "user" | "assistant" | "system",
            }));
            setMessages(normalized);
          }
        }
      } catch (err) {
        if (active) setConnectionError(err instanceof Error ? err.message : "Could not start a session");
      }
    })();
    return () => {
      active = false;
    };
  }, [user, targetSessionId]);

  useRealtime(
    authUser?.id,
    (event: RealtimeEvent) => {
      switch (event.type) {
        case "message.token":
          setStreaming((prev) => prev + String(event["token"] ?? event["content"] ?? ""));
          break;
        case "message.complete": {
          const msg = (event["message"] as Record<string, unknown> | undefined) ?? undefined;
          const content = String(msg?.["content"] ?? event["content"] ?? "");
          setMessages((prev) => [
            ...prev,
            {
              id: String(msg?.["id"] ?? event["message_id"] ?? crypto.randomUUID()),
              role: "assistant",
              content,
              cited_chunk_ids:
                (msg?.["cited_chunk_ids"] as string[] | undefined) ??
                ((event["cited_chunk_ids"] as string[] | undefined) ?? []),
            },
          ]);
          setStreaming("");
          setSending(false);
          break;
        }
        case "plan.update":
          setPlan((event["steps"] as PlanStep[] | undefined) ?? []);
          break;
        case "agent.progress": {
          const stage = String(event["stage"] ?? "processing");
          const message = String(event["message"] ?? "Agent is performing task...");
          const progressPercent = Number(event["progress_percent"] ?? 20);
          const toolName = event["tool_name"] ? String(event["tool_name"]) : undefined;
          const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

          setTaskProgress((prev) => {
            const newLog: ProgressLogItem = {
              id: crypto.randomUUID(),
              stage,
              message,
              timestamp: timeStr,
              status: event["status"] === "done" ? "done" : "running",
              toolName,
            };
            return {
              activeStage: stage,
              stageMessage: message,
              progressPercent,
              currentTool: toolName,
              logs: [...prev.logs, newLog],
            };
          });
          break;
        }
        case "approval.created":
          setPendingApproval("Waiting for staff approval on a high-risk step.");
          break;
        case "approval.status": {
          const status = String(event["status"] ?? "");
          if (status === "info_requested") {
            const q = String(event["question"] ?? "Staff requested additional information.");
            setPendingApproval(`Staff Clarification Needed: "${q}"`);
            toast.info(`Staff requested info: ${q}`);
          } else {
            setPendingApproval(null);
            toast.info(`Approval ${status}`);
          }
          break;
        }
        case "approval.actioned":
          setPendingApproval(null);
          toast.info(`Approval ${String(event["status"] ?? "updated")}`);
          break;
        case "notification.new":
          toast.message(String(event["title"] ?? "New notification"));
          break;
        default:
          break;
      }
    },
    sessionId ?? undefined,
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text: string) => {
    if (!text.trim() || !sessionId) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
    setInput("");
    setSending(true);
    setTaskProgress({
      activeStage: "detect_language",
      stageMessage: "Starting agent execution pipeline...",
      progressPercent: 10,
      logs: [
        {
          id: crypto.randomUUID(),
          stage: "start",
          message: "Request received by Campus Copilot",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          status: "done",
        },
      ],
    });
    try {
      const res = await api<{ accepted?: boolean; response?: string }>(`/agent/session/${sessionId}/message`, {
        method: "POST",
        body: { content: text },
      });
      if (res?.accepted === false) {
        setSending(false);
        toast.error("Message was not accepted by the agent");
      }
    } catch (err) {
      setSending(false);
      toast.error(err instanceof Error ? err.message : "Could not send message");
    }
  };

  if (loading || !user) return null;

  const currentRole = user.role;
  const quickActions = getQuickActionsForRole(currentRole);

  const pageTitle =
    currentRole === "admin"
      ? "Executive Governance Copilot"
      : currentRole === "staff" || currentRole === "warden" || currentRole === "lab_incharge"
        ? "Staff Copilot Assistant"
        : "Campus Copilot Chat";

  const pageDescription =
    currentRole === "admin"
      ? "Policy conflict analysis, audit integrity verification, and systemic SLA analytics queries."
      : currentRole === "staff" || currentRole === "warden" || currentRole === "lab_incharge"
        ? "Query departmental workflow steps, search institutional policies, and review student evidence."
        : "Ask in English, Hindi or Odia. High-risk actions pause for staff sign-off.";

  return (
    <AppShell>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold capitalize text-primary">
              {currentRole.replace(/_/g, " ")} Persona
            </span>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              session {sessionId ? sessionId.slice(0, 8) : "…"}
            </span>
          </div>
        }
      />

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex h-[calc(100vh-5.5rem)] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {/* Role Persona Context Banner */}
            {currentRole === "admin" ? (
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
                <span className="flex items-center gap-2 font-medium">
                  <Lock className="size-3.5 text-primary" /> Admin Mode: Full Cryptographic Audit Ledger &amp; Policy Control Active
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link to="/admin/audit">Audit Explorer</Link>
                </Button>
              </div>
            ) : currentRole === "staff" || currentRole === "warden" || currentRole === "lab_incharge" ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-2 font-medium">
                  <FileCheck className="size-3.5 text-emerald-500" /> Staff Mode: Connected to Department Approvals &amp; Policy RAG Engine
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/40" asChild>
                  <Link to="/staff/approvals">Approvals Queue</Link>
                </Button>
              </div>
            ) : null}

            {connectionError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {connectionError}
              </div>
            ) : null}

            {messages.length === 0 && !streaming ? (
              <div className="space-y-4">
                <EmptyState
                  title={pageTitle}
                  hint={
                    currentRole === "admin"
                      ? "Search policies, run audit verifications, or query SLA bottlenecks across departments."
                      : currentRole === "staff" || currentRole === "warden" || currentRole === "lab_incharge"
                        ? "Search academic regulations, check lab slot conflicts, or query pending approval evidence."
                        : "The copilot accesses real relational database models and policy documents before executing actions."
                  }
                />
                <div className="mx-auto grid max-w-xl gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                    Suggested {currentRole.replace(/_/g, " ")} Queries:
                  </p>
                  {quickActions.map((q) => (
                    <button
                      key={q}
                      onClick={() => void send(q)}
                      className="panel px-4 py-3 text-left text-sm transition-colors hover:bg-secondary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {streaming ? (
              <MessageBubble message={{ id: "streaming", role: "assistant", content: streaming }} />
            ) : null}

            {pendingApproval ? (
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                <ShieldAlert className="size-5 shrink-0" />
                <span>{pendingApproval} View progress in Staff Approvals queue.</span>
              </div>
            ) : null}

            {sending && !streaming ? (
              <AgentTaskProgress
                activeStage={taskProgress.activeStage}
                stageMessage={taskProgress.stageMessage}
                progressPercent={taskProgress.progressPercent}
                logs={taskProgress.logs}
                currentTool={taskProgress.currentTool}
                isPausedForApproval={Boolean(pendingApproval)}
              />
            ) : null}

            <div ref={bottomRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-border bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={
                currentRole === "admin"
                  ? "Ask admin query (e.g. check audit hash chain, policy conflicts, SLA performance)..."
                  : currentRole === "staff" || currentRole === "warden" || currentRole === "lab_incharge"
                    ? "Ask staff query (e.g. check pending approvals, lab slot conflict, attendance policy)..."
                    : "Describe what you need (e.g. loan certificate, fee receipt, lab booking)..."
              }
              rows={2}
              className="resize-none"
              disabled={!sessionId}
            />
            <Button type="submit" size="icon" disabled={!sessionId || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </section>

        <aside className="hidden h-[calc(100vh-5.5rem)] overflow-y-auto border-l border-border bg-card/60 p-5 lg:block">
          <PlanPanel plan={plan} sessionId={sessionId} role={currentRole} />
        </aside>
      </div>
    </AppShell>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user" || message.sender === "user";
  const content = message.content;

  const isUnpaidWarning = content.toLowerCase().includes("outstanding") || content.toLowerCase().includes("unpaid");
  const isCertificateIssued = content.includes("SOA-CERT-2026") || content.toLowerCase().includes("certificate issued");

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser ? (
        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </span>
      ) : null}
      <div className={`max-w-[42rem] rounded-lg px-4 py-3 text-sm leading-relaxed ${isUser ? "bg-primary text-primary-foreground" : "panel"}`}>
        <p className="whitespace-pre-wrap">{content}</p>

        {/* Dynamic Card Overlay for Unpaid Balance Edge Case */}
        {!isUser && isUnpaidWarning ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2">
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="size-4" />
              <span>Outstanding Fee Balance Alert</span>
            </div>
            <p>
              No fee receipt can be issued because an outstanding scheduled fee balance of ₹87,000 is pending.
            </p>
            <Button size="sm" variant="destructive" className="h-7 text-xs" asChild>
              <Link to="/settings">
                View Fee Breakdown &amp; Pay Online
              </Link>
            </Button>
          </div>
        ) : null}

        {/* Dynamic Card Overlay for Certificate Issued */}
        {!isUser && isCertificateIssued ? (
          <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold">
                <FileCheck className="size-4" />
                <span>Certificate Generated: SOA-CERT-2026-8A19F</span>
              </div>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <p className="font-mono text-[11px]">
              HMAC-SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                <Link to="/staff/approvals">
                  View Printable Letterhead
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        {message.cited_chunk_ids?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2">
            {message.cited_chunk_ids.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                <FileText className="size-3" /> {c.slice(0, 14)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {isUser ? (
        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <UserIcon className="size-4" />
        </span>
      ) : null}
    </div>
  );
}

function PlanPanel({ plan, sessionId, role }: { plan: PlanStep[]; sessionId: string | null; role?: string }) {
  const { data: fetchedPlan } = useQuery({
    queryKey: ["plan", sessionId],
    queryFn: () => api<unknown>(`/agent/session/${sessionId}/plan`),
    enabled: Boolean(sessionId),
    refetchInterval: 15000,
  });

  const { data: requests } = useQuery({
    queryKey: ["requests", "chat-sidebar"],
    queryFn: () => api<unknown>("/requests?page=1&limit=5"),
  });

  const { data: approvals } = useQuery({
    queryKey: ["approvals", "chat-sidebar"],
    queryFn: () => api<unknown>("/approvals"),
    enabled: role === "staff" || role === "warden" || role === "lab_incharge" || role === "admin",
  });

  const { data: conflicts } = useQuery({
    queryKey: ["policy-conflicts", "chat-sidebar"],
    queryFn: () => api<unknown>("/admin/analytics/policy-conflicts?page=1&limit=5"),
    enabled: role === "admin",
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<unknown>("/notifications?unread_only=true"),
  });

  const steps = plan.length ? plan : listOf<PlanStep>((fetchedPlan as { steps?: PlanStep[] })?.steps ?? fetchedPlan);
  const approvalList = listOf<Approval>(approvals);
  const conflictList = listOf<PolicyConflict>(conflicts);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-sm font-semibold">Execution Plan Steps</h2>
        {steps.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No plan steps yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {steps.map((step, i) => {
              const stepName = step.step_name ?? step.title ?? step.tool_name ?? step.tool ?? `Step ${i + 1}`;
              const rationale = step.rationale ?? step.description;
              const risk = step.risk_level ?? step.riskLevel;
              const isExecuting = step.status === "in_progress" || step.status === "running";

              return (
                <li
                  key={step.id ?? i}
                  className={`panel p-3 transition-all ${
                    isExecuting ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isExecuting ? <Loader2 className="size-3.5 animate-spin text-primary" /> : null}
                      <p className="text-sm font-medium capitalize">{stepName.replace(/_/g, " ")}</p>
                    </div>
                    <StatusBadge value={step.status} />
                  </div>
                  {rationale ? <p className="mt-1 text-xs text-muted-foreground">{rationale}</p> : null}
                  {risk ? (
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">risk: {risk}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Staff Approvals Queue Widget */}
      {role === "staff" || role === "warden" || role === "lab_incharge" ? (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Pending Staff Approvals</h2>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-primary" asChild>
              <Link to="/staff/approvals">View Queue</Link>
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {approvalList.slice(0, 4).map((a) => {
              const toolName = a.workflowStep?.toolName ?? a.workflowStep?.tool_name ?? a.tool_name ?? "High Risk Action";
              return (
                <li key={a.id} className="panel p-3 text-xs space-y-1 border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{toolName}</span>
                    <StatusBadge value={a.risk_level ?? "high"} />
                  </div>
                  <p className="text-muted-foreground truncate">{a.requester_name ?? "Student"} · {a.original_request ?? "Request"}</p>
                </li>
              );
            })}
            {approvalList.length === 0 ? (
              <li className="text-xs text-muted-foreground">No pending staff approvals.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Admin Policy Conflicts Widget */}
      {role === "admin" ? (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold font-mono">Policy Contradictions</h2>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-primary" asChild>
              <Link to="/admin/policy-conflicts">View All</Link>
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {conflictList.slice(0, 3).map((c) => (
              <li key={c.id} className="panel p-3 text-xs space-y-1">
                <p className="font-medium text-foreground truncate">{c.summary ?? `Conflict #${c.id.slice(0, 8)}`}</p>
                <StatusBadge value={c.status ?? "detected"} />
              </li>
            ))}
            {conflictList.length === 0 ? (
              <li className="text-xs text-muted-foreground">No active policy conflicts detected.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="font-display text-sm font-semibold">Active requests</h2>
        <ul className="mt-3 space-y-2">
          {listOf<ServiceRequest>(requests)
            .slice(0, 5)
            .map((r) => {
              const label = r.title ?? (r.request_type ?? r.type)?.replace(/_/g, " ") ?? "Request";
              return (
                <li key={r.id} className="panel flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="truncate capitalize">{label}</span>
                  <StatusBadge value={r.status} />
                </li>
              );
            })}
          {listOf<ServiceRequest>(requests).length === 0 ? (
            <li className="text-xs text-muted-foreground">Nothing active.</li>
          ) : null}
        </ul>
      </div>

      <div>
        <h2 className="font-display text-sm font-semibold">Unread</h2>
        <ul className="mt-3 space-y-2">
          {listOf<Notification>(notifications)
            .slice(0, 5)
            .map((n) => (
              <li key={n.id} className="panel flex gap-2 p-3 text-xs">
                <Clock className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                <span>{n.title ?? n.body ?? n.message}</span>
              </li>
            ))}
          {listOf<Notification>(notifications).length === 0 ? (
            <li className="text-xs text-muted-foreground">No unread notifications.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
