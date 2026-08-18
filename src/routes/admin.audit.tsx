import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, formatDate, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import type { AuditEvent, AuditVerifyResponse } from "@/lib/types";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Explorer · Campus Service Copilot" },
      {
        name: "description",
        content:
          "Browse the hash-chained audit trail of agent actions, approvals and system events.",
      },
      { property: "og:title", content: "Audit Explorer · Campus Service Copilot" },
      { property: "og:description", content: "Immutable audit log for campus service operations." },
    ],
  }),
  component: AuditExplorer,
});

function AuditExplorer() {
  const { user, loading } = useRequireRole(["admin"]);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<{ entityType: string; entityId: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ["audit", entityType, action],
    queryFn: () =>
      api<unknown>(
        `/audit/search?page=1&limit=50&entity_type=${encodeURIComponent(entityType)}&action=${encodeURIComponent(action)}`,
      ),
    enabled: Boolean(user),
  });

  const verify = useMutation({
    mutationFn: (input: { entityType: string; entityId: string }) =>
      api<AuditVerifyResponse>(`/audit/verify/${input.entityType}/${input.entityId}`),
    onSuccess: (res, vars) => {
      setVerifyResult((prev) => ({ ...prev, [`${vars.entityType}:${vars.entityId}`]: Boolean(res.intact) }));
      toast.success(res.intact ? "Audit chain intact" : "Audit chain verification failed (tampering detected)");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Verification failed"),
  });

  const entityTrail = useQuery({
    queryKey: ["audit", "entity", selectedEntity?.entityType, selectedEntity?.entityId],
    queryFn: () => api<AuditEvent[]>(`/audit/${selectedEntity?.entityType}/${selectedEntity?.entityId}`),
    enabled: Boolean(user && selectedEntity?.entityType && selectedEntity?.entityId),
  });

  if (loading || !user) return null;

  const events = listOf<AuditEvent>(query.data);

  return (
    <AppShell>
      <PageHeader
        title="Audit Explorer"
        description="Search hash-chained audit events and verify per-entity integrity."
      />

      <div className="p-6">
        <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="entity-type">Entity type</Label>
            <Input
              id="entity-type"
              placeholder="agent_sessions"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="action">Action</Label>
            <Input
              id="action"
              placeholder="N13.approval_creation"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setEntityType("");
                setAction("");
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>

        {query.isLoading ? <LoadingBlock /> : null}
        {query.error ? <ErrorBlock error={query.error} /> : null}
        {!query.isLoading && events.length === 0 ? (
          <EmptyState
            title="No audit events"
            hint="Events will appear once the backend audit pipeline is active."
          />
        ) : null}

        <ul className="space-y-2">
          {events.map((event) => {
            const eType = event.entityType ?? event.entity_type ?? "entity";
            const eId = event.entityId ?? event.entity_id ?? "";
            const eHash = event.entryHash ?? event.hash ?? "";
            const eCreated = event.createdAt ?? event.created_at;
            const eActor = event.actor ?? (event.actor_id ? `Actor ${event.actor_id.slice(0, 8)}` : "System");
            const key = `${eType}:${eId}`;

            return (
              <li key={event.id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium capitalize">
                    {event.action?.replace(/_/g, " ")} · {eType}
                  </p>
                  <span className="font-mono text-xs text-muted-foreground">
                    #{event.id.slice(0, 8)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {eActor} · {formatDate(eCreated)}
                </p>
                {eHash ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    Hash: {eHash.slice(0, 32)}…
                  </p>
                ) : null}
                <div className="mt-3 flex items-center gap-2">
                  {eType && eId ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={verify.isPending}
                        onClick={() => verify.mutate({ entityType: eType, entityId: eId })}
                      >
                        Verify chain
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedEntity({ entityType: eType, entityId: eId })}
                      >
                        View entity trail
                      </Button>
                    </>
                  ) : null}
                  {verifyResult[key] !== undefined ? (
                    <span className="text-xs text-muted-foreground">
                      Integrity: {verifyResult[key] ? "intact" : "broken"}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {selectedEntity ? (
          <div className="panel mt-6 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">
                Entity trail: {selectedEntity.entityType} · {selectedEntity.entityId}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEntity(null)}>
                Close
              </Button>
            </div>
            {entityTrail.isLoading ? <LoadingBlock label="Loading entity trail" /> : null}
            {entityTrail.error ? <ErrorBlock error={entityTrail.error} /> : null}
            {!entityTrail.isLoading && !entityTrail.error && entityTrail.data?.length === 0 ? (
              <EmptyState title="No entity events" hint="No hash chain entries found for this entity." />
            ) : null}
            <ul className="space-y-2">
              {(entityTrail.data ?? []).map((entry) => {
                const entryActor = entry.actor ?? (entry.actor_id ? `Actor ${entry.actor_id.slice(0, 8)}` : "System");
                const entryCreated = entry.createdAt ?? entry.created_at;
                return (
                  <li key={entry.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium capitalize">{entry.action?.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entryActor} · {formatDate(entryCreated)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
