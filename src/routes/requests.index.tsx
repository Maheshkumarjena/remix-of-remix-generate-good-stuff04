import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, StatusBadge, formatDate, listOf } from "@/components/common";
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

const statuses = ["all", "open", "in_progress", "pending_approval", "completed", "rejected"];

function RequestsPage() {
  const { user, loading } = useRequireRole();
  const { user: authUser } = useAuth();
  const [status, setStatus] = useState("all");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["requests", status],
    queryFn: () => api<unknown>(`/requests${qs({ page: 1, limit: 20, status: status === "all" ? "" : status })}`),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "status.changed") void queryClient.invalidateQueries({ queryKey: ["requests"] });
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
        requests.length === 0 ? (
          <EmptyState title="No requests yet" hint="Ask the copilot for a certificate, repair or lab slot." />
        ) : (
          <div className="space-y-3 p-6">
            {requests.map((r) => (
              <Link
                key={r.id}
                to="/requests/$requestId"
                params={{ requestId: r.id }}
                className="panel block p-4 transition-colors hover:bg-secondary/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium capitalize">
                      {r.title ?? r.type?.replace(/_/g, " ") ?? "Service request"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      #{r.id.slice(0, 8)} · created {formatDate(r.created_at)}
                      {r.sla_due_at ? ` · SLA ${formatDate(r.sla_due_at)}` : ""}
                    </p>
                  </div>
                  <StatusBadge value={r.status} />
                </div>
              </Link>
            ))}
          </div>
        )
      ) : null}
    </AppShell>
  );
}
