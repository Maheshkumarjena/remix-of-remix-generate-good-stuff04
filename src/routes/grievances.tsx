import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, StatusBadge, formatDate, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, qs } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { Grievance } from "@/lib/types";

export const Route = createFileRoute("/grievances")({
  head: () => ({
    meta: [
      { title: "Grievance Center · Campus Service Copilot" },
      {
        name: "description",
        content: "File campus grievances anonymously or on record and track status and escalation level.",
      },
      { property: "og:title", content: "Grievance Center · Campus Service Copilot" },
      { property: "og:description", content: "File and track campus grievances with escalation visibility." },
    ],
  }),
  component: GrievancesPage,
});

const categories = ["hostel_maintenance", "hostel", "mess", "academics", "infrastructure", "harassment", "other"];
const statusFilters = ["all", "open", "in_review", "escalated", "resolved", "rejected"];

function GrievancesPage() {
  const { user, loading } = useRequireRole();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "hostel_maintenance",
    description: "",
    is_anonymous: false,
    evidence_urls: "",
  });

  const query = useQuery({
    queryKey: ["grievances", status],
    queryFn: () => api<unknown>(`/grievances${qs({ page: 1, status: status === "all" ? "" : status })}`),
    enabled: Boolean(user),
  });

  const detailQuery = useQuery({
    queryKey: ["grievance", selectedId],
    queryFn: () => api<Grievance>(`/grievances/${selectedId}`),
    enabled: Boolean(user && selectedId),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "grievance.escalated") {
      toast.warning("A grievance was escalated");
      void queryClient.invalidateQueries({ queryKey: ["grievances"] });
      void queryClient.invalidateQueries({ queryKey: ["grievance"] });
    }
  });

  const create = useMutation({
    mutationFn: () =>
      api("/grievances", {
        method: "POST",
        body: {
          category: form.category,
          description: form.description,
          anonymous: form.is_anonymous,
          is_anonymous: form.is_anonymous,
          evidence_urls: form.evidence_urls
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Grievance filed");
      setForm({ category: "hostel_maintenance", description: "", is_anonymous: false, evidence_urls: "" });
      void queryClient.invalidateQueries({ queryKey: ["grievances"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not file grievance"),
  });

  const escalate = useMutation({
    mutationFn: (id: string) => api(`/grievances/${id}/escalate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Grievance escalated");
      void queryClient.invalidateQueries({ queryKey: ["grievances"] });
      if (selectedId) void queryClient.invalidateQueries({ queryKey: ["grievance", selectedId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not escalate grievance"),
  });

  if (loading || !user) return null;
  const grievances = listOf<Grievance>(query.data);
  const selectedFromList = selectedId ? grievances.find((g) => g.id === selectedId) ?? null : null;
  const selected = detailQuery.data ?? selectedFromList;
  const canEscalate = ["staff", "admin", "warden"].includes(user.role);

  return (
    <AppShell>
      <PageHeader
        title="Grievance Center"
        description="Anonymous filings hide your identity from staff, but stay auditable."
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          {query.isLoading ? <LoadingBlock /> : null}
          {query.error ? <ErrorBlock error={query.error} /> : null}
          {!query.isLoading && grievances.length === 0 ? (
            <EmptyState title="No grievances filed" hint="Use the form to raise your first grievance." />
          ) : null}

          {grievances.map((g) => {
            const isAnonymous = g.anonymous !== undefined ? g.anonymous : Boolean(g.is_anonymous);
            const escLevel = g.escalation_level ?? g.escalationLevel;
            const createdAt = g.createdAt ?? g.created_at;

            return (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={`panel block w-full p-4 text-left transition-colors hover:bg-secondary/60 ${
                  selectedId === g.id ? "border-primary/50 bg-secondary/50" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium capitalize">{g.category.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    {isAnonymous ? <StatusBadge value="anonymous" /> : null}
                    <StatusBadge value={g.status} />
                    {escLevel !== undefined ? (
                      <StatusBadge value={`level ${escLevel}`} />
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(createdAt)}</p>
              </button>
            );
          })}

          {selectedId ? (
            <div className="panel space-y-3 border-primary/40 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold capitalize">
                  {selected?.category ? selected.category.replace(/_/g, " ") : "Grievance"} detail
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                  Close
                </Button>
              </div>
              {detailQuery.isLoading ? <LoadingBlock /> : null}
              {!detailQuery.isLoading && selected ? (
                <>
                  <p className="text-sm">{selected.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={selected.status} />
                    <StatusBadge value={`escalation ${selected.escalation_level ?? selected.escalationLevel ?? 0}`} />
                    {(selected.anonymous ?? selected.is_anonymous) ? <StatusBadge value="anonymous" /> : null}
                    {(selected.sla_due_at ?? selected.slaDueAt) ? (
                      <span className="text-xs text-muted-foreground">
                        SLA Due: {formatDate(selected.sla_due_at ?? selected.slaDueAt)}
                      </span>
                    ) : null}
                  </div>
                  {selected.evidence_urls?.length ? (
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-muted-foreground">Evidence attachments:</p>
                      <ul className="space-y-1">
                        {selected.evidence_urls.map((u) => (
                          <li key={u}>
                            <a href={u} target="_blank" rel="noreferrer" className="text-primary underline">
                              {u}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selected.escalation_history?.length ? (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Escalation History
                      </p>
                      <ol className="space-y-2 border-l border-border pl-4">
                        {selected.escalation_history.map((h, i) => (
                          <li key={i} className="text-xs">
                            <p className="font-medium">Level {h.level} {h.escalated_by ? `by ${h.escalated_by}` : ""}</p>
                            <p className="text-muted-foreground">{formatDate(h.escalated_at)}</p>
                            {h.reason ? <p className="mt-0.5 text-muted-foreground">{h.reason}</p> : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {canEscalate ? (
                    <Button
                      variant="outline"
                      disabled={escalate.isPending || !selected.id}
                      onClick={() => escalate.mutate(selected.id)}
                    >
                      Escalate grievance
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Escalation is handled by authorized staff when policy or SLA conditions are met.
                    </p>
                  )}
                </>
              ) : null}
              {detailQuery.error ? <ErrorBlock error={detailQuery.error} /> : null}
            </div>
          ) : null}
        </section>

        <aside className="panel h-fit space-y-4 p-5">
          <h2 className="font-display text-sm font-semibold">File a grievance</h2>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue with dates and location."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence URLs (comma separated)</Label>
            <Input
              id="evidence"
              value={form.evidence_urls}
              onChange={(e) => setForm({ ...form, evidence_urls: e.target.value })}
              placeholder="https://…, https://…"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="anon" className="text-sm font-normal">
              File anonymously
            </Label>
            <Switch
              id="anon"
              checked={form.is_anonymous}
              onCheckedChange={(v) => setForm({ ...form, is_anonymous: v })}
            />
          </div>
          <Button
            className="w-full"
            disabled={form.description.trim().length < 10 || create.isPending}
            onClick={() => create.mutate()}
          >
            Submit grievance
          </Button>
        </aside>
      </div>
    </AppShell>
  );
}
