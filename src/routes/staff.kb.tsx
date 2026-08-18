import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  StatusBadge,
  formatDate,
  listOf,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import type { KbChunk, KbDocument } from "@/lib/types";

export const Route = createFileRoute("/staff/kb")({
  head: () => ({
    meta: [
      { title: "Knowledge Base Management · Campus Service Copilot" },
      {
        name: "description",
        content:
          "Staff tools to list indexed policy documents, add Markdown documents and debug retrieval results.",
      },
      { property: "og:title", content: "Knowledge Base Management · Campus Service Copilot" },
      {
        property: "og:description",
        content: "Add policy documents and debug how the campus agent retrieves them.",
      },
    ],
  }),
  component: StaffKnowledgeBase,
});

function StaffKnowledgeBase() {
  const { user, loading } = useRequireRole(["staff", "warden", "lab_incharge", "admin"]);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KbChunk[] | null>(null);

  const docsQuery = useQuery({
    queryKey: ["staff-kb"],
    queryFn: () => api<unknown>("/kb/documents?page=1&limit=50"),
    enabled: Boolean(user),
  });

  const create = useMutation({
    mutationFn: () =>
      api<KbDocument>("/kb/documents", {
        method: "POST",
        body: {
          title,
          document_id: documentId,
          version,
          content,
          effective_date: effectiveDate || undefined,
        },
      }),
    onSuccess: (doc) => {
      toast.success(`Indexed “${doc.title}” (${doc.chunk_count ?? 0} chunks)`);
      setTitle("");
      setDocumentId("");
      setEffectiveDate("");
      setContent("");
      void queryClient.invalidateQueries({ queryKey: ["staff-kb"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
  });

  const search = useMutation({
    mutationFn: () => api<unknown>("/kb/search", { method: "POST", body: { query, top_k: 5 } }),
    onSuccess: (data) => setResults(listOf<KbChunk>(data)),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Search failed"),
  });

  if (loading || !user) return null;

  const docs = listOf<KbDocument>(docsQuery.data);

  return (
    <AppShell>
      <PageHeader
        title="Knowledge Base"
        description="Indexed policy documents, Markdown ingestion and a retrieval debugger."
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Indexed documents
          </h2>

          {docsQuery.isLoading ? <LoadingBlock /> : null}
          {docsQuery.error ? <ErrorBlock error={docsQuery.error} /> : null}
          {!docsQuery.isLoading && docs.length === 0 ? (
            <EmptyState
              title="No documents indexed"
              hint="Add a Markdown policy document to enable grounded answers with citations."
            />
          ) : null}

          <ul className="space-y-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="panel flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Version {doc.version ?? "—"} · {doc.chunk_count ?? 0} chunks · updated{" "}
                    {formatDate(doc.updated_at)}
                  </p>
                </div>
                <StatusBadge value={doc.status} />
              </li>
            ))}
          </ul>

          <div className="panel space-y-4 p-4">
            <div>
              <h3 className="text-sm font-medium">Retrieval debugger</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Run the same semantic search the agent uses and inspect the matched chunks.
              </p>
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) search.mutate();
              }}
            >
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. bonafide certificate processing time"
              />
              <Button type="submit" disabled={search.isPending || !query.trim()}>
                <Search className="size-4" /> Search
              </Button>
            </form>

            {results ? (
              results.length === 0 ? (
                <p className="text-xs text-muted-foreground">No chunks matched that query.</p>
              ) : (
                <ul className="space-y-2">
                  {results.map((chunk, i) => (
                    <li
                      key={chunk.chunk_id ?? chunk.id ?? i}
                      className="rounded-md border border-border bg-muted/30 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">
                          {chunk.document_id ?? "document"}
                          {chunk.clause ? ` · clause ${chunk.clause}` : ""}
                          {chunk.page ? ` · p.${chunk.page}` : ""}
                        </span>
                        {typeof chunk.similarity === "number" ? (
                          <span className="font-mono">
                            similarity {chunk.similarity.toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm">{chunk.text ?? chunk.content}</p>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </section>

        <aside className="panel h-fit space-y-4 p-4">
          <div>
            <h2 className="text-sm font-medium">Add Markdown document</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste policy text; paragraphs are chunked and indexed for citations.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim() && content.trim()) create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="kb-title">Title</Label>
              <Input
                id="kb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Examinations Circular 2026"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-version">Version</Label>
              <Input
                id="kb-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-document-id">Document ID</Label>
              <Input
                id="kb-document-id"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="ACAD-CERT-001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-effective-date">Effective date</Label>
              <Input
                id="kb-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-content">Markdown content</Label>
              <Textarea
                id="kb-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder={"## 1. Scope\n\nThis circular applies to...\n\n## 2. Timelines\n\nTranscripts are issued within..."}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={create.isPending || !title.trim() || !documentId.trim() || !content.trim()}
            >
              {create.isPending ? "Indexing…" : "Index document"}
            </Button>
          </form>
        </aside>
      </div>
    </AppShell>
  );
}
