import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, StatusBadge, formatDate, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, qs } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { ServiceRequest } from "@/lib/types";

export const Route = createFileRoute("/staff/requests")({
  head: () => ({
    meta: [
      { title: "Request Management · Campus Service Copilot" },
      {
        name: "description",
        content: "Staff view to triage department service requests and move them through the workflow.",
      },
      { property: "og:title", content: "Request Management · Campus Service Copilot" },
      { property: "og:description", content: "Triage and update department service requests." },
    ],
  }),
  component: StaffRequests,
});

const filters = ["all", "open", "in_progress", "pending_approval", "completed", "rejected"];
const nextStatuses = ["in_progress", "pending_approval", "completed", "rejected"];

function StaffRequests() {
  const { user, loading } = useRequireRole(["staff", "warden", "lab_incharge", "admin"]);
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");

  const query = useQuery({
    queryKey: ["staff-requests", status],
    queryFn: () => api<unknown>(`/requests${qs({ page: 1, limit: 20, status: status === "all" ? "" : status })}`),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "status.changed") void queryClient.invalidateQueries({ queryKey: ["staff-requests"] });
  });

  const update = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      api(`/requests/${input.id}/status`, { method: "PATCH", body: { status: input.status } }),
    onSuccess: () => {
      toast.success("Status updated");
      void queryClient.invalidateQueries({ queryKey: ["staff-requests"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  if (loading || !user) return null;
  const requests = listOf<ServiceRequest>(query.data);

  return (
    <AppShell>
      <PageHeader
        title="Request Management"
        description="Department queue with inline status transitions."
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filters.map((s) => (
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
      {!query.isLoading && requests.length === 0 ? <EmptyState title="No requests in this filter" /> : null}

      <div className="space-y-3 p-6">
        {requests.map((r) => (
          <div key={r.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <Link
                to="/requests/$requestId"
                params={{ requestId: r.id }}
                className="truncate font-medium capitalize hover:underline"
              >
                {r.title ?? r.type?.replace(/_/g, " ")}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                #{r.id.slice(0, 8)} · {r.department ?? "—"} · SLA {formatDate(r.sla_due_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge value={r.status} />
              <Select value="" onValueChange={(v) => update.mutate({ id: r.id, status: v })}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Update status" />
                </SelectTrigger>
                <SelectContent>
                  {nextStatuses.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/requests/$requestId" params={{ requestId: r.id }}>
                  Open
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
