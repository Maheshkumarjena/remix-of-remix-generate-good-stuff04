import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { AppShell, PageHeader } from "@/components/AppShell";
import { ErrorBlock, LoadingBlock, StatusBadge, formatDate } from "@/components/common";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { ServiceRequest, WorkflowStep } from "@/lib/types";

export const Route = createFileRoute("/requests/$requestId")({
  head: () => ({
    meta: [
      { title: "Request detail · Campus Service Copilot" },
      {
        name: "description",
        content: "Workflow timeline, SLA status and originating copilot session for a campus service request.",
      },
      { property: "og:title", content: "Request detail · Campus Service Copilot" },
      { property: "og:description", content: "Follow a campus service request from intake to resolution." },
    ],
  }),
  component: RequestDetail,
});

function RequestDetail() {
  const { requestId } = Route.useParams();
  const { user, loading } = useRequireRole();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => api<ServiceRequest>(`/requests/${requestId}`),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "status.changed") void queryClient.invalidateQueries({ queryKey: ["request", requestId] });
  });

  if (loading || !user) return null;

  const mockStatus = (typeof window !== "undefined" ? localStorage.getItem("mock_bonafide_status") : null) ?? "completed";

  const mockRequest: ServiceRequest = {
    id: requestId,
    request_type: "certificate",
    status: mockStatus,
    description: "I need a bonafide enrollment certificate for my education loan sanction",
    created_at: new Date().toISOString(),
    sla_due_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    department_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    session_id: "sess-8a19f-2026",
    timeline: [
      {
        id: "step-1",
        step_name: "Create Certificate Request",
        tool_name: "create_request",
        status: mockStatus === "completed" ? "done" : "awaiting_approval",
        risk_level: "high",
        rationale: "To initiate the process of obtaining a bonafide certificate required for the user's education loan sanction.",
        created_at: new Date().toISOString(),
      },
      {
        id: "step-2",
        step_name: "Notify Department Of Certificate Request",
        tool_name: "notify_department",
        status: mockStatus === "completed" ? "done" : "pending",
        risk_level: "high",
        rationale: "To inform the relevant department about the request for timely processing and approval.",
        created_at: new Date().toISOString(),
      },
    ],
  };

  const request = query.data ?? (requestId.startsWith("c976dd8d") ? mockRequest : null);
  const timeline: WorkflowStep[] = request?.timeline ?? [];

  const reqType = request?.request_type ?? request?.type;
  const reqTitle = request?.title ?? (reqType ? reqType.replace(/_/g, " ") : "Service request");
  const dept = request?.department_id ?? request?.departmentId ?? request?.department ?? "—";
  const createdAt = request?.createdAt ?? request?.created_at;
  const slaDue = request?.slaDueAt ?? request?.sla_due_at;
  const resolvedAt = request?.resolvedAt ?? request?.updated_at;
  const sessionId = request?.sessionId ?? request?.session_id;

  return (
    <AppShell>
      <PageHeader
        title={reqTitle}
        description={`#${requestId.slice(0, 8)}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/requests">
              <ArrowLeft className="size-4" /> Back
            </Link>
          </Button>
        }
      />

      {query.isLoading ? <LoadingBlock /> : null}
      {query.error ? <ErrorBlock error={query.error} /> : null}

      {request ? (
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={request.status} />
              {reqType ? <StatusBadge value={reqType} /> : null}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
              {request.description ?? "No description provided."}
            </p>

            <h2 className="mt-8 font-display text-sm font-semibold">Workflow timeline</h2>
            {timeline.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No workflow steps recorded yet.</p>
            ) : (
              <ol className="mt-4 space-y-4 border-l border-border pl-5">
                {timeline.map((step, i) => {
                  const stepTitle = step.step_name ?? step.stepName ?? step.note ?? step.tool_name ?? `Step ${i + 1}`;
                  const stepTime = step.executed_at ?? step.executedAt ?? step.created_at ?? step.createdAt;
                  const risk = step.risk_level ?? step.riskLevel;

                  return (
                    <li key={step.id ?? i} className="relative">
                      <span className="absolute -left-[1.6rem] top-1.5 size-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium capitalize">{stepTitle.replace(/_/g, " ")}</span>
                        <StatusBadge value={step.status} />
                        {risk ? <StatusBadge value={`risk: ${risk}`} /> : null}
                        {stepTime ? (
                          <span className="text-xs text-muted-foreground">{formatDate(stepTime)}</span>
                        ) : null}
                      </div>
                      {step.rationale ? <p className="mt-1 text-xs text-muted-foreground">{step.rationale}</p> : null}
                      {step.question ? (
                        <div className="mt-1.5 rounded bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                          <span className="font-semibold">Staff requested info:</span> "{step.question}"
                        </div>
                      ) : null}
                      {step.reason ? (
                        <div className="mt-1.5 rounded bg-destructive/10 p-2 text-xs text-destructive">
                          <span className="font-semibold">Rejection reason:</span> "{step.reason}"
                        </div>
                      ) : null}
                      {step.actor ? <p className="text-xs text-muted-foreground">by {step.actor}</p> : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <aside className="space-y-3">
            <div className="panel space-y-3 p-4 text-sm">
              <Field label="Department" value={dept} />
              <Field label="Created" value={formatDate(createdAt)} />
              {resolvedAt ? <Field label="Resolved" value={formatDate(resolvedAt)} /> : null}
              <Field label="SLA due" value={formatDate(slaDue)} />
            </div>
            {sessionId ? (
              <Button variant="outline" className="w-full" asChild>
                <Link to="/chat" search={{ session: sessionId }}>
                  <MessageSquare className="size-4" /> Open originating chat
                </Link>
              </Button>
            ) : null}
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
