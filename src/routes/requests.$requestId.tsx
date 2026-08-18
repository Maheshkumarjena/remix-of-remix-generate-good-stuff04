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
  const request = query.data;
  const timeline: WorkflowStep[] = request?.timeline ?? [];

  return (
    <AppShell>
      <PageHeader
        title={request?.title ?? "Service request"}
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
              <StatusBadge value={request.type} />
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
              {request.description ?? "No description provided."}
            </p>

            <h2 className="mt-8 font-display text-sm font-semibold">Workflow timeline</h2>
            {timeline.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No workflow steps recorded yet.</p>
            ) : (
              <ol className="mt-4 space-y-4 border-l border-border pl-5">
                {timeline.map((step, i) => (
                  <li key={step.id ?? i} className="relative">
                    <span className="absolute -left-[1.6rem] top-1.5 size-2 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={step.status} />
                      <span className="text-xs text-muted-foreground">{formatDate(step.created_at)}</span>
                    </div>
                    {step.note ? <p className="mt-1 text-sm">{step.note}</p> : null}
                    {step.actor ? <p className="text-xs text-muted-foreground">by {step.actor}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <aside className="space-y-3">
            <div className="panel space-y-3 p-4 text-sm">
              <Field label="Department" value={request.department ?? "—"} />
              <Field label="Created" value={formatDate(request.created_at)} />
              <Field label="Updated" value={formatDate(request.updated_at)} />
              <Field label="SLA due" value={formatDate(request.sla_due_at)} />
            </div>
            {request.session_id ? (
              <Button variant="outline" className="w-full" asChild>
                <Link to="/chat">
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
