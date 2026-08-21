import { Activity, CheckCircle2, ChevronDown, ChevronUp, Cpu, FileSearch, ShieldCheck, Sparkles, Terminal, Wrench } from "lucide-react";
import { useState } from "react";

export interface ProgressLogItem {
  id: string;
  stage: string;
  message: string;
  timestamp: string;
  status?: "pending" | "running" | "done" | "warning";
  toolName?: string;
}

export interface AgentTaskProgressProps {
  activeStage?: string;
  stageMessage?: string;
  progressPercent?: number;
  logs?: ProgressLogItem[];
  currentTool?: string;
  isPausedForApproval?: boolean;
}

const stageIcons: Record<string, typeof Activity> = {
  detect_language: Sparkles,
  identity_check: ShieldCheck,
  classify_intent: Activity,
  guardrail_input_screen: ShieldCheck,
  retrieve: FileSearch,
  guardrail_doc_screen: ShieldCheck,
  confidence_evaluator: Activity,
  generate_plan: Cpu,
  risk_classify_steps: ShieldCheck,
  step_loop: Wrench,
  notify_user: CheckCircle2,
};

export function AgentTaskProgress({
  activeStage = "Processing",
  stageMessage = "Copilot is executing agent workflow...",
  progressPercent = 15,
  logs = [],
  currentTool,
  isPausedForApproval = false,
}: AgentTaskProgressProps) {
  const [showLogs, setShowLogs] = useState(true);
  const IconComponent = stageIcons[activeStage] ?? Cpu;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-primary/20 bg-card/90 shadow-lg shadow-primary/5 backdrop-blur-md transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <IconComponent className="size-4 animate-pulse" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-ping" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Agent Active Step
              </span>
              {currentTool ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
                  tool: {currentTool}
                </span>
              ) : null}
            </div>
            <p className="text-sm font-medium text-foreground">{stageMessage}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Terminal className="size-3.5" />
          <span>{logs.length} task updates</span>
          {showLogs ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="relative h-1.5 w-full bg-muted/40 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary via-indigo-500 to-emerald-400 transition-all duration-500 ease-out"
          style={{ width: `${Math.max(10, Math.min(100, progressPercent))}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      </div>

      {/* Execution Log Timeline */}
      {showLogs && logs.length > 0 ? (
        <div className="max-h-48 overflow-y-auto p-3 space-y-1.5 bg-muted/10 font-mono text-xs">
          {logs.map((log, idx) => {
            const isLast = idx === logs.length - 1;
            return (
              <div
                key={log.id || idx}
                className={`flex items-start gap-2 rounded px-2 py-1 transition-colors ${
                  isLast ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                {log.status === "done" || (!isLast && !isPausedForApproval) ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Activity className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
                )}
                <div className="flex-1 overflow-hidden truncate">
                  <span className="opacity-60">[{log.timestamp || "now"}]</span>{" "}
                  <span>{log.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
