import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, StatusBadge, formatDate, listOf } from "@/components/common";
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

        <ul className="space-y-3">
          {conflicts.map((conflict) => {
            const raisedAt = conflict.raised_at ?? conflict.detected_at;
            const docA = conflict.doc_a ?? (conflict.document_a as { document_id?: string; clause?: string; version?: string } | undefined);
            const docB = conflict.doc_b ?? (conflict.document_b as { document_id?: string; clause?: string; version?: string } | undefined);

            return (
              <li key={conflict.id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {conflict.summary ?? `Policy Conflict #${conflict.id.slice(0, 8)}`}
                  </p>
                  <div className="flex items-center gap-2">
                    {conflict.status ? <StatusBadge value={conflict.status} /> : null}
                    <span className="text-xs text-muted-foreground">{formatDate(raisedAt)}</span>
                  </div>
                </div>

                {docA && docB ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                      <p className="font-semibold text-foreground">Document A: {docA.document_id ?? "—"}</p>
                      <p className="mt-1 text-muted-foreground">Version: {docA.version ?? "—"}</p>
                      <p className="mt-1 text-muted-foreground font-mono">{docA.clause ?? "—"}</p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                      <p className="font-semibold text-foreground">Document B: {docB.document_id ?? "—"}</p>
                      <p className="mt-1 text-muted-foreground">Version: {docB.version ?? "—"}</p>
                      <p className="mt-1 text-muted-foreground font-mono">{docB.clause ?? "—"}</p>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
