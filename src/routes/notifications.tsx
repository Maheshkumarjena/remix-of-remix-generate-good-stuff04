import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, formatDate, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api, qs } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { Notification } from "@/lib/types";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · Campus Service Copilot" },
      {
        name: "description",
        content: "Inbox for campus copilot updates: approvals, request status changes and escalations.",
      },
      { property: "og:title", content: "Notifications · Campus Service Copilot" },
      { property: "og:description", content: "Live inbox for agent and workflow updates." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading } = useRequireRole();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ["notifications", unreadOnly],
    queryFn: () => api<unknown>(`/notifications${qs({ page: 1, unread_only: unreadOnly ? "true" : "" })}`),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "notification.new") {
      toast.message(String(event["title"] ?? "New notification"));
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markRead = useMutation({
    mutationFn: (ids: string[] | "all") =>
      api("/notifications/mark-read", {
        method: "POST",
        body: ids === "all" ? {} : { ids },
      }),
    onSuccess: () => {
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update notifications"),
  });

  if (loading || !user) return null;
  const notifications = listOf<Notification>(query.data);

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        description="Approvals, status changes and agent updates."
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="unread" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
              <Label htmlFor="unread" className="text-sm font-normal">
                Unread only
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={selected.length === 0 || markRead.isPending}
              onClick={() => markRead.mutate(selected)}
            >
              Mark selected read
            </Button>
            <Button size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate("all")}>
              Mark all read
            </Button>
          </div>
        }
      />

      {query.isLoading ? <LoadingBlock /> : null}
      {query.error ? <ErrorBlock error={query.error} /> : null}

      <div className="space-y-2 p-6">
        {!query.isLoading && notifications.length === 0 ? (
          <EmptyState title="Inbox is clear" hint="Copilot and workflow updates will show up here." />
        ) : null}

        {notifications.map((n) => {
          const isRead = n.readFlag !== undefined ? n.readFlag : (n.read ?? n.is_read ?? false);
          const createdAt = n.createdAt ?? n.created_at;

          return (
            <div key={n.id} className={`panel flex items-start gap-3 p-4 ${isRead ? "opacity-70" : ""}`}>
              <Checkbox
                checked={selected.includes(n.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) => (checked ? [...prev, n.id] : prev.filter((id) => id !== n.id)))
                }
                aria-label="Select notification"
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title ?? "Update"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body ?? n.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(createdAt)}</p>
              </div>
              {n.deepLink ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void navigate({ to: n.deepLink as string })}
                >
                  Open
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
