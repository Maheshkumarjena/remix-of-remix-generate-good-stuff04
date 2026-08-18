import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, Clock, FileText, Loader2, Send, ShieldAlert, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, StatusBadge, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime, type RealtimeEvent } from "@/lib/socket";
import type { AgentMessage, Notification, PlanStep, ServiceRequest } from "@/lib/types";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Campus Copilot Chat" },
      {
        name: "description",
        content:
          "Chat with the campus agent to request certificates, hostel maintenance, lab bookings and grievance help with cited policy answers.",
      },
      { property: "og:title", content: "Campus Copilot Chat" },
      { property: "og:description", content: "Agentic chat with live plan updates and staff approval states." },
    ],
  }),
  component: ChatPage,
});

const quickActions = [
  "I need a bonafide certificate for a scholarship application.",
  "The fan in my hostel room is not working.",
  "Book me a slot in the electronics lab tomorrow.",
  "I want to file a grievance about mess food quality.",
];

function ChatPage() {
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const session = await api<{ id?: string; session_id?: string }>("/agent/session", { method: "POST" });
        const id = session.id ?? session.session_id ?? null;
        if (!active) return;
        setSessionId(id);
        if (id) {
          const detail = await api<{ messages?: AgentMessage[] }>(`/agent/session/${id}`).catch(() => null);
          if (active && detail?.messages) setMessages(detail.messages);
        }
      } catch (err) {
        if (active) setConnectionError(err instanceof Error ? err.message : "Could not start a session");
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

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
        case "approval.created":
          setPendingApproval("Waiting for staff approval on a high-risk step.");
          break;
        case "approval.status":
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
    try {
      const res = await api<{ accepted?: boolean }>(`/agent/session/${sessionId}/message`, {
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

  return (
    <AppShell>
      <PageHeader
        title="Campus Copilot"
        description="Ask in English, Hindi or Odia. High-risk actions pause for staff approval."
        actions={
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            session {sessionId ? sessionId.slice(0, 8) : "…"}
          </span>
        }
      />

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex h-[calc(100vh-5.5rem)] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {connectionError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {connectionError}
              </div>
            ) : null}

            {messages.length === 0 && !streaming ? (
              <div className="space-y-4">
                <EmptyState
                  title="Start a conversation"
                  hint="The copilot retrieves institutional documents before it acts, and cites what it used."
                />
                <div className="mx-auto grid max-w-xl gap-2">
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
              <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                <ShieldAlert className="size-4" />
                {pendingApproval}
              </div>
            ) : null}

            {sending && !streaming ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Copilot is thinking…
              </div>
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
              placeholder="Describe what you need…"
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
          <PlanPanel plan={plan} sessionId={sessionId} />
        </aside>
      </div>
    </AppShell>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser ? (
        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </span>
      ) : null}
      <div
        className={`max-w-[42rem] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isUser ? "bg-primary text-primary-foreground" : "panel"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.cited_chunk_ids?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2">
            {message.cited_chunk_ids.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                <FileText className="size-3" /> {c.slice(0, 12)}
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

function PlanPanel({ plan, sessionId }: { plan: PlanStep[]; sessionId: string | null }) {
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

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<unknown>("/notifications?unread_only=true"),
  });

  const steps = plan.length ? plan : listOf<PlanStep>((fetchedPlan as { steps?: PlanStep[] })?.steps ?? fetchedPlan);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-sm font-semibold">Current plan</h2>
        {steps.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No plan steps yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {steps.map((step, i) => (
              <li key={step.id ?? i} className="panel p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{step.title ?? step.tool ?? `Step ${i + 1}`}</p>
                  <StatusBadge value={step.status} />
                </div>
                {step.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                ) : null}
                {step.risk_level ? (
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    risk: {step.risk_level}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h2 className="font-display text-sm font-semibold">Active requests</h2>
        <ul className="mt-3 space-y-2">
          {listOf<ServiceRequest>(requests)
            .slice(0, 5)
            .map((r) => (
              <li key={r.id} className="panel flex items-center justify-between gap-2 p-3 text-sm">
                <span className="truncate capitalize">{r.title ?? r.type?.replace(/_/g, " ")}</span>
                <StatusBadge value={r.status} />
              </li>
            ))}
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
                <span>{n.title ?? n.message ?? n.body}</span>
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
