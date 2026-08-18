import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, formatDate, listOf } from "@/components/common";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import type { PolicyConflict } from "@/lib/types";

export const Route = createFileRoute("/admin/policy-conflicts")({
  head: () => ({
    meta: [
      { title: "Policy Conflicts · Campus Service Copilot" },
      {
        name: "description",
        content:
          "Review contradictions and overlaps detected across institutional policy documents.",
      },
      { property: "og:title", content: "Policy Conflicts · Campus Service Copilot" },
      { property: "og:description", content: "Detected policy contradictions and overlaps." },
    ],
  }),
  component: PolicyConflicts,
});

function PolicyConflicts() {
  const { user, loading } = useRequireRole(["admin"]);

  const query = useQuery({
    queryKey: ["policy-conflicts"],
    queryFn: () => api<unknown>("/admin/analytics/policy-conflicts?page=1&limit=50"),
    enabled: Boolean(user),
  });

  if (loading || !user) return null;

  const conflicts = listOf<PolicyConflict>(query.data);

  return (
    <AppShell>
      <PageHeader
        title="Policy Conflicts"
        description="Contradictions and overlaps detected across institutional documents."
      />

      <div className="p-6">
        {query.isLoading ? <LoadingBlock /> : null}
        {query.error ? <ErrorBlock error={query.error} /> : null}
        {!query.isLoading && conflicts.length === 0 ? (
          <EmptyState
            title="No conflicts detected"
            hint="Run a policy scan to surface contradictions."
          />
        ) : null}

        <ul className="space-y-2">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="panel p-4">
              <p className="text-sm font-medium">
                {conflict.summary ?? `Conflict ${conflict.id.slice(0, 8)}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Detected {formatDate(conflict.detected_at)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
