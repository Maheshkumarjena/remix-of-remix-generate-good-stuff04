import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, StatusBadge, formatDate, listOf } from "@/components/common";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import type { KbDocument } from "@/lib/types";

export const Route = createFileRoute("/admin/kb")({
  head: () => ({
    meta: [
      { title: "Knowledge Base · Campus Service Copilot" },
      {
        name: "description",
        content: "Manage institutional documents that ground the campus agent's answers and citations.",
      },
      { property: "og:title", content: "Knowledge Base · Campus Service Copilot" },
      { property: "og:description", content: "Indexed documents for policy-grounded agent answers." },
    ],
  }),
  component: KnowledgeBase,
});

function KnowledgeBase() {
  const { user, loading } = useRequireRole(["admin"]);

  const query = useQuery({
    queryKey: ["kb"],
    queryFn: () => api<unknown>("/kb?page=1&limit=50"),
    enabled: Boolean(user),
  });

  if (loading || !user) return null;

  const docs = listOf<KbDocument>(query.data);

  return (
    <AppShell>
      <PageHeader
        title="Knowledge Base"
        description="Institutional documents that ground agent answers and citations."
      />

      <div className="p-6">
        {query.isLoading ? <LoadingBlock /> : null}
        {query.error ? <ErrorBlock error={query.error} /> : null}
        {!query.isLoading && docs.length === 0 ? (
          <EmptyState title="No documents indexed" hint="Upload policy documents to enable citations in chat." />
        ) : null}

        <ul className="space-y-2">
          {docs.map((doc) => (
            <li key={doc.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{doc.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Version {doc.version ?? "—"} · {doc.chunk_count ?? 0} chunks · updated {formatDate(doc.updated_at)}
                </p>
              </div>
              <StatusBadge value={doc.status} />
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
