import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, StatusBadge, formatDate, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { Approval } from "@/lib/types";

export const Route = createFileRoute("/staff/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Queue · Campus Service Copilot" },
      {
        name: "description",
        content: "Review agent reasoning, retrieved evidence and proposed tool calls before approving high-risk actions.",
      },
      { property: "og:title", content: "Approval Queue · Campus Service Copilot" },
      { property: "og:description", content: "Human-in-the-loop review for medium and high-risk agent actions." },
    ],
  }),
  component: ApprovalQueue,
});

function ApprovalQueue() {
  const { user, loading } = useRequireRole(["staff", "warden", "lab_incharge", "admin"]);
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");

  const query = useQuery({
    queryKey: ["approvals"],
    queryFn: () => api<unknown>("/approvals"),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (["approval.created", "approval.status", "approval.actioned"].includes(event.type))
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
  });

  const approvals = listOf<Approval>(query.data);
  const selected = approvals.find((a) => a.id === selectedId) ?? approvals[0] ?? null;

  const decide = useMutation({
    mutationFn: async (input: { id: string; action: "approve" | "reject" | "request-info"; body?: unknown }) =>
      api(`/approvals/${input.id}/${input.action}`, { method: "POST", body: input.body ?? {} }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.action === "approve"
          ? "Approved — the tool is executing server-side"
          : variables.action === "reject"
            ? "Rejected"
            : "Question sent back to the agent session",
      );
      setReason("");
      setQuestion("");
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Decision failed"),
  });

  if (loading || !user) return null;

  return (
    <AppShell>
      <PageHeader title="Approval Queue" description="Approving executes the registered tool on the backend." />

      {query.isLoading ? <LoadingBlock /> : null}
      {query.error ? <ErrorBlock error={query.error} /> : null}
      {!query.isLoading && approvals.length === 0 ? (
        <EmptyState title="Queue is empty" hint="High-risk agent steps will appear here for review." />
      ) : null}

      {approvals.length > 0 ? (
        <div className="grid gap-6 p-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelectedId(a.id)}
                  className={`panel w-full p-3 text-left transition-colors hover:bg-secondary/60 ${
                    selected?.id === a.id ? "border-primary/50 bg-secondary/50" : ""
                  }`}
                >
                  <p className="truncate text-sm font-medium">{a.tool_name ?? "Agent action"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(a.created_at)}</p>
                  <div className="mt-2 flex gap-2">
                    <StatusBadge value={a.risk_level} />
                    <StatusBadge value={a.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <div className="space-y-4">
              <div className="panel p-5">
                <h2 className="font-display text-sm font-semibold">Original request</h2>
                <p className="mt-2 text-sm">{selected.original_request ?? "—"}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {selected.requester_name ?? "Student"}
                  {selected.session_id ? ` · session ${selected.session_id.slice(0, 8)}` : ""}
                </p>
              </div>

              <div className="panel p-5">
                <h2 className="font-display text-sm font-semibold">Reasoning trace</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {selected.reasoning ?? "No reasoning trace provided."}
                </p>
              </div>

              <div className="panel p-5">
                <h2 className="font-display text-sm font-semibold">Retrieved evidence</h2>
                {selected.evidence?.length ? (
                  <ul className="mt-3 space-y-2">
                    {selected.evidence.map((e, i) => (
                      <li key={i} className="rounded-md border border-border p-3 text-sm">
                        <p className="font-mono text-[11px] text-muted-foreground">
                          doc {e.document_id ?? "—"} · v{e.version ?? "—"} · page {e.page ?? "—"} · clause{" "}
                          {e.clause ?? "—"} · sim {e.similarity?.toFixed?.(3) ?? "—"}
                        </p>
                        {e.text ? <p className="mt-2 text-muted-foreground">{e.text}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : selected.cited_chunk_ids?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selected.cited_chunk_ids.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                      >
                        <FileText className="size-3" /> {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No citations attached.</p>
                )}
              </div>

              <div className="panel p-5">
                <h2 className="font-display text-sm font-semibold">Proposed tool call</h2>
                <p className="mt-2 font-mono text-sm">{selected.tool_name ?? "—"}</p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {JSON.stringify(selected.tool_args ?? {}, null, 2)}
                </pre>
              </div>

              <div className="panel space-y-4 p-5">
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    placeholder="Rejection reason (minimum 10 characters)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Textarea
                    rows={2}
                    placeholder="Ask the student a clarifying question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: selected.id, action: "approve" })}
                  >
                    Approve & execute
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={decide.isPending || reason.trim().length < 10}
                    onClick={() => decide.mutate({ id: selected.id, action: "reject", body: { reason } })}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    disabled={decide.isPending || question.trim().length === 0}
                    onClick={() => decide.mutate({ id: selected.id, action: "request-info", body: { question } })}
                  >
                    Request more info
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
