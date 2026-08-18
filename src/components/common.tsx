import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}…
    </div>
  );
}

export function ErrorBlock({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="m-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <AlertTriangle className="mt-0.5 size-4 text-destructive" />
      <div>
        <p className="font-medium text-destructive">Request failed</p>
        <p className="mt-1 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const tone: Record<string, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/35",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

function toneFor(value: string): keyof typeof tone {
  const v = value.toLowerCase();
  if (["approved", "completed", "resolved", "closed", "issued", "success", "verified"].some((k) => v.includes(k)))
    return "success";
  if (["pending", "waiting", "review", "in_progress", "escalated", "medium"].some((k) => v.includes(k)))
    return "warning";
  if (["rejected", "failed", "conflict", "high", "critical", "breached"].some((k) => v.includes(k)))
    return "danger";
  if (["open", "new", "created", "low", "info"].some((k) => v.includes(k))) return "info";
  return "neutral";
}

export function StatusBadge({
  value,
  className,
}: {
  value?: string | number | null | undefined;
  className?: string | undefined;
}) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value);
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", tone[toneFor(text)], className)}>
      {text.replace(/_/g, " ")}
    </Badge>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function listOf<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as { data?: T[]; items?: T[]; results?: T[] } | null;
  return obj?.data ?? obj?.items ?? obj?.results ?? [];
}
