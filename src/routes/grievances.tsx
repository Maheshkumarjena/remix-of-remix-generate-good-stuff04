import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, ShieldAlert } from "lucide-react";
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
import type { ExamRecord, Grievance } from "@/lib/types";

export const Route = createFileRoute("/grievances")({
  head: () => ({
    meta: [
      { title: "Grievance Center · Campus Service Copilot" },
      {
        name: "description",
        content: "File campus grievances anonymously or on record and track status and HOD escalation levels.",
      },
      { property: "og:title", content: "Grievance Center · Campus Service Copilot" },
      { property: "og:description", content: "File and track campus grievances with escalation visibility." },
    ],
  }),
  component: GrievancesPage,
});

const categories = [
  "academic_evaluation",
  "hostel_maintenance",
  "hostel",
  "mess",
  "academics",
  "infrastructure",
  "harassment",
  "other",
];
const statusFilters = ["all", "open", "in_review", "escalated", "resolved", "rejected"];

function GrievancesPage() {
  const { user, loading } = useRequireRole();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [form, setForm] = useState({
    category: "academic_evaluation",
    description: "Requesting re-evaluation of CS301 DBMS mid-sem paper due to evaluation discrepancy in question 4 database normalization proof.",
    is_anonymous: false,
    evidence_urls: "",
  });

  const query = useQuery({
    queryKey: ["grievances", status],
    queryFn: () => api<unknown>(`/grievances${qs({ page: 1, status: status === "all" ? "" : status })}`),
    enabled: Boolean(user),
  });

  const examRecordsQuery = useQuery({
    queryKey: ["exam-records-grievance"],
    queryFn: () => api<ExamRecord[]>("/students/me/exam-records"),
    enabled: Boolean(user && user.role === "student"),
  });

  const examList: ExamRecord[] = (examRecordsQuery.data as ExamRecord[] | undefined) ?? [
    {
      id: "exam-1",
      subjectCode: "CS301",
      subjectName: "Database Management Systems",
      examType: "mid_sem",
      marksObtained: 38,
      maxMarks: 50,
      status: "published",
    },
    {
      id: "exam-2",
      subjectCode: "CS305",
      subjectName: "Operating Systems",
      examType: "mid_sem",
      marksObtained: 44,
      maxMarks: 50,
      status: "published",
    },
  ];

  const detailQuery = useQuery({
    queryKey: ["grievance", selectedId],
    queryFn: () => api<Grievance>(`/grievances/${selectedId}`),
    enabled: Boolean(user && selectedId),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "grievance.escalated") {
      toast.warning("Grievance Status Update: Escalated to Level 2 (HOD Review)");
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
          exam_record_id: selectedExamId || undefined,
          anonymous: form.is_anonymous,
          is_anonymous: form.is_anonymous,
          evidence_urls: form.evidence_urls
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Academic Grievance filed successfully");
      setForm({ category: "academic_evaluation", description: "", is_anonymous: false, evidence_urls: "" });
      void queryClient.invalidateQueries({ queryKey: ["grievances"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not file grievance"),
  });

  const escalate = useMutation({
    mutationFn: (id: string) => api(`/grievances/${id}/escalate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Grievance Escalated to Level 2 (HOD Review)");
      void queryClient.invalidateQueries({ queryKey: ["grievances"] });
      if (selectedId) void queryClient.invalidateQueries({ queryKey: ["grievance", selectedId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not escalate grievance"),
  });

  if (loading || !user) return null;

  // Sample grievance item for demo
  const sampleAcademicGrievance: Grievance = {
    id: "griev-1",
    category: "academic_evaluation",
    description: "Requesting re-evaluation of DBMS mid-sem paper (CS301). Marks awarded 38/50. Discrepancy identified in Q3 relational algebra query evaluation.",
    status: "escalated",
    anonymous: false,
    escalation_level: 2,
    created_at: new Date().toISOString(),
    escalation_history: [
      {
        level: 1,
        escalated_at: new Date(Date.now() - 86400000).toISOString(),
        escalated_by: "Academic Section Staff",
        reason: "Initial verification completed",
      },
      {
        level: 2,
        escalated_at: new Date().toISOString(),
        escalated_by: "Academic Section Head",
        reason: "Escalated to Level 2 (HOD Review) for re-assessment of paper script.",
      },
    ],
  };

  const sampleHostelGrievance: Grievance = {
    id: "griev-2",
    category: "hostel_maintenance",
    description: "Severe water leakage and broken plumbing in Hostel Block B, Room 214.",
    status: "open",
    anonymous: false,
    escalation_level: 1,
    created_at: new Date().toISOString(),
    escalation_history: [
      {
        level: 1,
        escalated_at: new Date().toISOString(),
        escalated_by: "Hostel Warden",
        reason: "Logged by student for hostel maintenance review",
      },
    ],
  };

  const sampleGrievance = user.role === "warden" ? sampleHostelGrievance : sampleAcademicGrievance;

  const rawGrievances = listOf<Grievance>(query.data);
  const grievances = rawGrievances.length > 0 ? rawGrievances : [sampleGrievance];
  const selectedFromList = selectedId ? grievances.find((g) => g.id === selectedId) ?? null : null;
  const selected = detailQuery.data ?? selectedFromList ?? grievances[0] ?? null;
  const canEscalate = ["staff", "admin", "warden", "lab_incharge"].includes(user.role);

  return (
    <AppShell>
      <PageHeader
        title="Grievance &amp; Re-Evaluation Center"
        description="Submit academic evaluation grievances or service issues with multi-level HOD escalation tracking."
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

          {grievances.map((g) => {
            const isAnonymous = g.anonymous !== undefined ? g.anonymous : Boolean(g.is_anonymous);
            const escLevel = Number(g.escalation_level ?? g.escalationLevel ?? 1);
            const createdAt = g.createdAt ?? g.created_at;

            return (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={`panel block w-full p-4 text-left transition-colors hover:bg-secondary/60 ${
                  selected?.id === g.id ? "border-primary/50 bg-secondary/50" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium capitalize">{g.category.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    {isAnonymous ? <StatusBadge value="anonymous" /> : null}
                    <StatusBadge value={g.status} />
                    {escLevel >= 2 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-semibold text-xs text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <ShieldAlert className="size-3" /> Escalated to Level 2 (HOD Review)
                      </span>
                    ) : (
                      <StatusBadge value={`Level ${escLevel}`} />
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(createdAt)}</p>
              </button>
            );
          })}

          {selected ? (
            <div className="panel space-y-3 border-primary/40 p-5 mt-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-display text-sm font-semibold capitalize">
                  {selected.category ? selected.category.replace(/_/g, " ") : "Grievance"} Details
                </h2>
                <span className="font-mono text-xs text-muted-foreground">ID: #{selected.id.slice(0, 8)}</span>
              </div>

              <p className="text-sm leading-relaxed">{selected.description}</p>

              <div className="flex flex-wrap gap-2 pt-1">
                <StatusBadge value={selected.status} />
                {Number(selected.escalation_level ?? selected.escalationLevel ?? 1) >= 2 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <ShieldAlert className="size-3.5" /> Escalated to Level 2 (HOD Review)
                  </span>
                ) : (
                  <StatusBadge value={`Escalation Level ${selected.escalation_level ?? 1}`} />
                )}
                {(selected.anonymous ?? selected.is_anonymous) ? <StatusBadge value="anonymous" /> : null}
              </div>

              {selected.escalation_history?.length ? (
                <div className="space-y-2 pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Escalation &amp; Review History
                  </p>
                  <ol className="space-y-2 border-l border-border pl-4">
                    {selected.escalation_history.map((h, i) => (
                      <li key={i} className="text-xs space-y-0.5">
                        <p className="font-medium text-foreground">
                          Level {h.level} Review {h.escalated_by ? `by ${h.escalated_by}` : ""}
                        </p>
                        <p className="text-muted-foreground">{formatDate(h.escalated_at)}</p>
                        {h.reason ? <p className="text-muted-foreground italic">"{h.reason}"</p> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {canEscalate ? (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    disabled={escalate.isPending || !selected.id}
                    onClick={() => escalate.mutate(selected.id)}
                  >
                    Escalate to Level 2 (HOD Review)
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Grievance Submission Form */}
        <aside className="panel h-fit space-y-4 p-5">
          <h2 className="font-display text-sm font-semibold">File a Grievance / Re-Evaluation</h2>

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

          {form.category === "academic_evaluation" ? (
            <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <Label className="text-xs font-semibold text-primary flex items-center gap-1">
                <Award className="size-3.5" /> Select Exam Record for Re-Evaluation
              </Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="w-full bg-card">
                  <SelectValue placeholder="Select examination paper" />
                </SelectTrigger>
                <SelectContent>
                  {examList.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.subjectCode}: {ex.subjectName} ({ex.marksObtained}/{ex.maxMarks})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="desc">Detailed Description</Label>
            <Textarea
              id="desc"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the discrepancy or grievance details clearly..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence Attachments (URLs)</Label>
            <Input
              id="evidence"
              value={form.evidence_urls}
              onChange={(e) => setForm({ ...form, evidence_urls: e.target.value })}
              placeholder="https://..., https://..."
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="anon" className="text-sm font-normal">
              Submit Anonymously
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
            Submit Grievance
          </Button>
        </aside>
      </div>
    </AppShell>
  );
}
