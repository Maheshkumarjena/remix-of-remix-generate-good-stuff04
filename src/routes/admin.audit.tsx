import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, formatDate, listOf } from "@/components/common";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import type { AuditEvent } from "@/lib/types";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Explorer · Campus Service Copilot" },
      {
        name: "description",
        content: "Browse the hash-chained audit trail of agent actions, approvals and system events.",
      },
      { property: "og:title", content: "Audit Explorer · Campus Service Copilot" },
      { property: "og:description", content: "Immutable audit log for campus service operations." },
    ],
  }),
  component: AuditExplorer,
});

function AuditExplorer() {
  const { user, loading } = useRequireRole(["admin"]);

  const query = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<unknown>("/audit?page=1&limit=50"),
    enabled: Boolean(user),
  });

  if (loading || !user) return null;

  const events = listOf<AuditEvent>(query.data);

  return (
    <AppShell>
      <PageHeader
        title="Audit Explorer"
        description="Hash-chained record of agent actions, approvals and system events."
      />

      <div className="p-6">
        {query.isLoading ? <LoadingBlock /> : null}
        {query.error ? <ErrorBlock error={query.error} /> : null}
        {!query.isLoading && events.length === 0 ? (
          <EmptyState title="No audit events" hint="Events will appear once the backend audit pipeline is active." />
        ) : null}

        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium capitalize">
                  {event.action?.replace(/_/g, " ")} · {event.entity_type}
                </p>
                <span className="font-mono text-xs text-muted-foreground">#{event.id.slice(0, 8)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.actor_id ? `Actor ${event.actor_id.slice(0, 8)}` : "System"} · {formatDate(event.created_at)}
              </p>
              {event.hash ? (
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">Hash: {event.hash.slice(0, 32)}…</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
