import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch, Library, ScrollText } from "lucide-react";

import { AppShell, PageHeader } from "@/components/AppShell";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Stat,
  StatusBadge,
  formatDate,
  listOf,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type {
  AuditEvent,
  BottlenecksResponse,
  KbDocument,
  PolicyConflict,
  RequestsSummary,
  ResolutionTimeSeries,
} from "@/lib/types";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Governance · Campus Service Copilot" },
      {
        name: "description",
        content:
          "Governance dashboard for administrators: audit trail, policy conflicts and knowledge base health.",
      },
      { property: "og:title", content: "Admin Governance · Campus Service Copilot" },
      {
        property: "og:description",
        content: "Campus-wide oversight, audit explorer and policy conflict monitoring.",
      },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user, loading } = useRequireRole(["admin"]);
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const requestSummary = useQuery({
    queryKey: ["admin", "analytics", "requests-summary"],
    queryFn: () => api<RequestsSummary>("/admin/analytics/requests-summary"),
    enabled: Boolean(user),
  });
  const resolutionTime = useQuery({
    queryKey: ["admin", "analytics", "resolution-time"],
    queryFn: () => api<ResolutionTimeSeries>("/admin/analytics/resolution-time"),
    enabled: Boolean(user),
  });
  const bottlenecks = useQuery({
    queryKey: ["admin", "analytics", "bottlenecks"],
    queryFn: () => api<BottlenecksResponse>("/admin/analytics/bottlenecks"),
    enabled: Boolean(user),
  });
  const audit = useQuery({
    queryKey: ["audit", "recent"],
    queryFn: () => api<unknown>("/audit/search?page=1&limit=5"),
    enabled: Boolean(user),
  });
  const conflicts = useQuery({
    queryKey: ["policy-conflicts", "recent"],
    queryFn: () => api<unknown>("/admin/analytics/policy-conflicts?page=1&limit=5"),
    enabled: Boolean(user),
  });
  const kb = useQuery({
    queryKey: ["kb", "recent"],
    queryFn: () => api<unknown>("/kb/documents?page=1&limit=5"),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "approval.created")
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    if (event.type === "audit.created") void queryClient.invalidateQueries({ queryKey: ["audit"] });
  });

  if (loading || !user) return null;

  const byType = requestSummary.data?.by_type ?? [];
  const byStatus = requestSummary.data?.by_status ?? [];
  const requestTotal = byType.reduce((sum, item) => sum + item.count, 0);
  const pendingTotal = byStatus
    .filter((item) => ["pending", "in_progress", "pending_approval", "open"].includes(item.status))
    .reduce((sum, item) => sum + item.count, 0);
  const resolutionPoints = resolutionTime.data?.points ?? [];
  const latestResolution = resolutionPoints.length
    ? resolutionPoints[resolutionPoints.length - 1]?.avg_resolution_hours ?? 0
    : 0;
  const bottleneckItems = bottlenecks.data?.items ?? [];
  const bottleneckTotal = bottleneckItems.reduce((sum, item) => sum + item.overdue_count, 0);
  const auditList = listOf<AuditEvent>(audit.data);
  const conflictList = listOf<PolicyConflict>(conflicts.data);
  const kbList = listOf<KbDocument>(kb.data);

  return (
    <AppShell>
      <PageHeader
        title="Governance"
        description="Campus-wide oversight, audit trail and policy health."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/audit">Open audit explorer</Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total requests" value={requestTotal} hint="Across all departments" />
          <Stat label="Active queue" value={pendingTotal} hint="Pending and in-progress requests" />
          <Stat label="Policy conflicts" value={conflictList.length} hint="Detected mismatches" />
          <Stat
            label="Avg resolution"
            value={latestResolution ? `${latestResolution.toFixed(2)}h` : "0h"}
            hint={`Overdue bottlenecks: ${bottleneckTotal}`}
          />
        </div>

        {requestSummary.error ? <ErrorBlock error={requestSummary.error} /> : null}
        {resolutionTime.error ? <ErrorBlock error={resolutionTime.error} /> : null}
        {bottlenecks.error ? <ErrorBlock error={bottlenecks.error} /> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <FileSearch className="size-4 text-muted-foreground" />
                <h2 className="font-display text-sm font-semibold">Recent audit events</h2>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/policy-conflicts">View all</Link>
              </Button>
            </div>
            <div className="p-2">
              {audit.isLoading ? <LoadingBlock /> : null}
              {audit.error ? <ErrorBlock error={audit.error} /> : null}
              {!audit.isLoading && auditList.length === 0 ? (
                <EmptyState title="No audit events" hint="Hash-chained actions will appear here." />
              ) : null}
              <ul className="divide-y divide-border">
                {auditList.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-4 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize">
                        {event.action?.replace(/_/g, " ")} · {event.entity_type}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.actor_id ? `Actor ${event.actor_id.slice(0, 8)}` : "System"} ·{" "}
                        {formatDate(event.created_at)}
                      </p>
                    </div>
                    <StatusBadge value={event.entity_type} />
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <ScrollText className="size-4 text-muted-foreground" />
                <h2 className="font-display text-sm font-semibold">Policy conflicts</h2>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/policy-conflicts">View all</Link>
              </Button>
            </div>
            <div className="p-2">
              {conflicts.isLoading ? <LoadingBlock /> : null}
              {conflicts.error ? <ErrorBlock error={conflicts.error} /> : null}
              {!conflicts.isLoading && conflictList.length === 0 ? (
                <EmptyState
                  title="No conflicts detected"
                  hint="Policy contradictions will surface here."
                />
              ) : null}
              <ul className="divide-y divide-border">
                {conflictList.map((conflict) => (
                  <li key={conflict.id} className="px-3 py-3">
                    <p className="text-sm font-medium">
                      {conflict.summary ?? `Conflict ${conflict.id.slice(0, 8)}`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Detected {formatDate(conflict.detected_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Library className="size-4 text-muted-foreground" />
                <h2 className="font-display text-sm font-semibold">Knowledge base</h2>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/kb">Manage documents</Link>
              </Button>
            </div>
            <div className="p-2">
              {kb.isLoading ? <LoadingBlock /> : null}
              {kb.error ? <ErrorBlock error={kb.error} /> : null}
              {!kb.isLoading && kbList.length === 0 ? (
                <EmptyState
                  title="No documents indexed"
                  hint="Upload institutional documents to ground agent answers."
                />
              ) : null}
              <ul className="divide-y divide-border">
                {kbList.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-4 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Version {doc.version ?? "—"} · {doc.chunk_count ?? 0} chunks · updated{" "}
                        {formatDate(doc.updated_at)}
                      </p>
                    </div>
                    <StatusBadge value={doc.status} />
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-display text-sm font-semibold">Operational bottlenecks</h2>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/policy-conflicts">Review conflicts</Link>
              </Button>
            </div>
            <div className="p-2">
              {bottlenecks.isLoading ? <LoadingBlock /> : null}
              {!bottlenecks.isLoading && bottleneckItems.length === 0 ? (
                <EmptyState title="No bottlenecks" hint="No overdue workflow steps detected right now." />
              ) : null}
              <ul className="divide-y divide-border">
                {bottleneckItems.map((item) => (
                  <li
                    key={`${item.department}-${item.step_name}`}
                    className="flex items-center justify-between gap-4 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.step_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Department {item.department}</p>
                    </div>
                    <StatusBadge value={`${item.overdue_count} overdue`} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
