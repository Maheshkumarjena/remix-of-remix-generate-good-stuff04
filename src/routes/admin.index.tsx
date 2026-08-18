import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch, Library, ScrollText } from "lucide-react";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, Stat, StatusBadge, formatDate, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { Approval, AuditEvent, KbDocument, PolicyConflict, ServiceRequest } from "@/lib/types";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Governance · Campus Service Copilot" },
      {
        name: "description",
        content: "Governance dashboard for administrators: audit trail, policy conflicts and knowledge base health.",
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

  const requests = useQuery({
    queryKey: ["requests", "admin"],
    queryFn: () => api<unknown>("/requests?page=1&limit=1"),
    enabled: Boolean(user),
  });
  const approvals = useQuery({
    queryKey: ["approvals", "admin"],
    queryFn: () => api<unknown>("/approvals?page=1&limit=1"),
    enabled: Boolean(user),
  });
  const audit = useQuery({
    queryKey: ["audit", "recent"],
    queryFn: () => api<unknown>("/audit?page=1&limit=5"),
    enabled: Boolean(user),
  });
  const conflicts = useQuery({
    queryKey: ["policy-conflicts", "recent"],
    queryFn: () => api<unknown>("/policy-conflicts?page=1&limit=5"),
    enabled: Boolean(user),
  });
  const kb = useQuery({
    queryKey: ["kb", "recent"],
    queryFn: () => api<unknown>("/kb?page=1&limit=5"),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "approval.created") void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    if (event.type === "audit.created") void queryClient.invalidateQueries({ queryKey: ["audit"] });
  });

  if (loading || !user) return null;

  const requestTotal = totalFrom(requests.data);
  const approvalTotal = totalFrom(approvals.data);
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
          <Stat label="Total approvals" value={approvalTotal} hint="Human-in-the-loop actions" />
          <Stat label="Policy conflicts" value={conflictList.length} hint="Detected mismatches" />
          <Stat label="KB documents" value={kbList.length} hint="Indexed documents" />
        </div>

        {requests.error ? <ErrorBlock error={requests.error} /> : null}
        {approvals.error ? <ErrorBlock error={approvals.error} /> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <FileSearch className="size-4 text-muted-foreground" />
                <h2 className="font-display text-sm font-semibold">Recent audit events</h2>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/audit">View all</Link>
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
                <Link to="/admin/audit">View all</Link>
              </Button>
            </div>
            <div className="p-2">
              {conflicts.isLoading ? <LoadingBlock /> : null}
              {conflicts.error ? <ErrorBlock error={conflicts.error} /> : null}
              {!conflicts.isLoading && conflictList.length === 0 ? (
                <EmptyState title="No conflicts detected" hint="Policy contradictions will surface here." />
              ) : null}
              <ul className="divide-y divide-border">
                {conflictList.map((conflict) => (
                  <li key={conflict.id} className="px-3 py-3">
                    <p className="text-sm font-medium">{conflict.summary ?? `Conflict ${conflict.id.slice(0, 8)}`}</p>
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
                <EmptyState title="No documents indexed" hint="Upload institutional documents to ground agent answers." />
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
        </div>
      </div>
    </AppShell>
  );
}

function totalFrom(payload: unknown): number {
  if (payload && typeof payload === "object" && "total" in payload && typeof payload.total === "number") {
    return payload.total;
  }
  return listOf<ServiceRequest | Approval>(payload).length;
}
