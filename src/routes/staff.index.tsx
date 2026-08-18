import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, Stat, StatusBadge, formatDate, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { Approval, Notification, ServiceRequest } from "@/lib/types";

export const Route = createFileRoute("/staff/")({
  head: () => ({
    meta: [
      { title: "Staff Dashboard · Campus Service Copilot" },
      {
        name: "description",
        content: "Operational queue for staff, wardens and lab in-charges: approvals, department requests and alerts.",
      },
      { property: "og:title", content: "Staff Dashboard · Campus Service Copilot" },
      { property: "og:description", content: "Approvals and department request queue in one operational view." },
    ],
  }),
  component: StaffDashboard,
});

function StaffDashboard() {
  const { user, loading } = useRequireRole(["staff", "warden", "lab_incharge", "admin"]);
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const approvals = useQuery({
    queryKey: ["approvals"],
    queryFn: () => api<unknown>("/approvals"),
    enabled: Boolean(user),
  });
  const requests = useQuery({
    queryKey: ["requests", "staff"],
    queryFn: () => api<unknown>("/requests?page=1&limit=20"),
    enabled: Boolean(user),
  });
  const notifications = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<unknown>("/notifications?unread_only=true"),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "approval.created") void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    if (event.type === "notification.new") void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  if (loading || !user) return null;
  const approvalList = listOf<Approval>(approvals.data);
  const requestList = listOf<ServiceRequest>(requests.data);
  const notificationList = listOf<Notification>(notifications.data);

  return (
    <AppShell>
      <PageHeader
        title="Staff Dashboard"
        description="Human-in-the-loop queue for agent actions and department workload."
        actions={
          <Button asChild size="sm">
            <Link to="/staff/approvals">Open approval queue</Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Pending approvals" value={approvalList.length} hint="Awaiting your decision" />
          <Stat label="Department requests" value={requestList.length} hint="Latest 20 in queue" />
          <Stat label="Unread alerts" value={notificationList.length} />
        </div>

        {approvals.error ? <ErrorBlock error={approvals.error} /> : null}
        {approvals.isLoading ? <LoadingBlock /> : null}

        <section>
          <h2 className="font-display text-sm font-semibold">Pending approvals</h2>
          <div className="mt-3 space-y-2">
            {approvalList.length === 0 && !approvals.isLoading ? (
              <EmptyState title="No approvals waiting" hint="Agent actions needing review will land here." />
            ) : null}
            {approvalList.slice(0, 5).map((a) => (
              <Link
                key={a.id}
                to="/staff/approvals"
                className="panel flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-secondary/60"
              >
                <div>
                  <p className="text-sm font-medium">{a.tool_name ?? "Agent action"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.requester_name ?? "Student"} · {formatDate(a.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge value={a.risk_level} />
                  <StatusBadge value={a.status} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-sm font-semibold">Recent requests</h2>
          <div className="mt-3 space-y-2">
            {requestList.slice(0, 8).map((r) => (
              <Link
                key={r.id}
                to="/requests/$requestId"
                params={{ requestId: r.id }}
                className="panel flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-secondary/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize">
                    {r.title ?? r.type?.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    #{r.id.slice(0, 8)} · SLA {formatDate(r.sla_due_at)}
                  </p>
                </div>
                <StatusBadge value={r.status} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
