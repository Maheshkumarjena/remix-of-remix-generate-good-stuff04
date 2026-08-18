import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { api, qs } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { ServiceRequest } from "@/lib/types";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "My Requests · Campus Service Copilot" },
      {
        name: "description",
        content: "Track campus service requests, workflow timelines and SLA due dates in one place.",
      },
      { property: "og:title", content: "My Requests · Campus Service Copilot" },
      { property: "og:description", content: "Track request status, SLA and the originating copilot session." },
    ],
  }),
  component: RequestsPage,
});

const statuses = ["all", "open", "in_progress", "pending", "pending_approval", "completed", "resolved", "rejected"];

function RequestsPage() {
  const { user, loading } = useRequireRole();
  const { user: authUser } = useAuth();
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({
    request_type: "bonafide_certificate",
    description: "",
    department_id: "",
  });
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["requests", status],
    queryFn: () => api<unknown>(`/requests${qs({ page: 1, limit: 20, status: status === "all" ? "" : status })}`),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "status.changed") void queryClient.invalidateQueries({ queryKey: ["requests"] });
  });

  const create = useMutation({
    mutationFn: () =>
      api<ServiceRequest>("/requests", {
        method: "POST",
        body: {
          request_type: form.request_type,
          description: form.description,
          department_id: form.department_id || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Request created");
      setForm({ request_type: "bonafide_certificate", description: "", department_id: "" });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create request"),
  });

  if (loading || !user) return null;
  const requests = listOf<ServiceRequest>(query.data);

  return (
    <AppShell>
      <PageHeader
        title="My Requests"
        description="Everything you or the copilot raised on your behalf."
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {query.isLoading ? <LoadingBlock /> : null}
      {query.error ? <ErrorBlock error={query.error} /> : null}

      {!query.isLoading && !query.error ? (
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-3">
            {requests.length === 0 ? (
              <EmptyState title="No requests yet" hint="Ask the copilot for a certificate, repair or lab slot." />
            ) : (
              requests.map((r) => {
                const reqType = r.request_type ?? r.type;
                const reqTitle = r.title ?? (reqType ? reqType.replace(/_/g, " ") : "Service request");
                const createdAt = r.createdAt ?? r.created_at;
                const slaDue = r.slaDueAt ?? r.sla_due_at;

                return (
                  <Link
                    key={r.id}
                    to="/requests/$requestId"
                    params={{ requestId: r.id }}
                    className="panel block p-4 transition-colors hover:bg-secondary/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium capitalize">{reqTitle}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          #{r.id.slice(0, 8)} · created {formatDate(createdAt)}
                          {slaDue ? ` · SLA ${formatDate(slaDue)}` : ""}
                        </p>
                      </div>
                      <StatusBadge value={r.status} />
                    </div>
                  </Link>
                );
              })
            )}
          </section>

          <aside className="panel h-fit space-y-4 p-5">
            <h2 className="font-display text-sm font-semibold">Create request manually</h2>
            <div className="space-y-2">
              <Label>Request type</Label>
              <Select
                value={form.request_type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, request_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonafide_certificate">Bonafide Certificate</SelectItem>
                  <SelectItem value="hostel_maintenance">Hostel Maintenance</SelectItem>
                  <SelectItem value="lab_booking">Lab Booking</SelectItem>
                  <SelectItem value="grievance">Grievance Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-description">Description</Label>
              <Textarea
                id="request-description"
                rows={5}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your request clearly with location and purpose."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-department">Department ID (optional)</Label>
              <Input
                id="request-department"
                value={form.department_id}
                onChange={(e) => setForm((prev) => ({ ...prev, department_id: e.target.value }))}
                placeholder="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
              />
            </div>
            <Button
              className="w-full"
              disabled={form.description.trim().length < 10 || create.isPending}
              onClick={() => create.mutate()}
            >
              Submit request
            </Button>
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}
