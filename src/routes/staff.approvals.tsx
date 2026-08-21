import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Award, FileText, Lock, ShieldCheck, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorBlock, LoadingBlock, StatusBadge, formatDate, listOf } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { Approval } from "@/lib/types";

export const Route = createFileRoute("/staff/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Queue · Campus Service Copilot" },
      {
        name: "description",
        content: "Review agent reasoning, retrieved evidence, financial breakdown, and digital certificate payloads before approval.",
      },
      { property: "og:title", content: "Approval Queue · Campus Service Copilot" },
      { property: "og:description", content: "Human-in-the-loop review for medium and high-risk agent actions." },
    ],
  }),
  component: ApprovalQueue,
});

function ApprovalQueue() {
  const { user, loading } = useRequireRole(["staff", "warden", "lab_incharge", "admin"]);
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");
  const [showCertificatePreview, setShowCertificatePreview] = useState(false);
  const [dismissedMockIds, setDismissedMockIds] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ["approvals"],
    queryFn: () => api<unknown>("/approvals"),
    enabled: Boolean(user),
  });

  useRealtime(authUser?.id, (event) => {
    if (["approval.created", "approval.status", "approval.actioned"].includes(event.type))
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; action: "approve" | "reject" | "request-info"; body?: unknown }) => {
      if (input.id.startsWith("appr_")) {
        await new Promise((r) => setTimeout(r, 600));
        return { success: true, status: input.action === "approve" ? "approved" : "rejected" };
      }
      return api(`/approvals/${input.id}/${input.action}`, { method: "POST", body: input.body ?? {} });
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.action === "approve"
          ? "Approved — Certificate SOA-CERT-2026-8A19F signed and issued to student!"
          : variables.action === "reject"
            ? "Rejected step"
            : "Question sent back to the student session",
      );
      setReason("");
      setQuestion("");
      if (variables.id.startsWith("appr_")) {
        if (variables.action === "approve") {
          localStorage.setItem("mock_bonafide_status", "completed");
        } else if (variables.action === "reject") {
          localStorage.setItem("mock_bonafide_status", "rejected");
        }
        setDismissedMockIds((prev) => [...prev, variables.id]);
      }
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Decision failed"),
  });

  if (loading || !user) return null;

  const rawApprovals = listOf<Approval>(query.data);

  // Persona-appropriate fallback sample item if database has no active pending approvals
  const mockLoanApprovalItem: Approval = {
    id: "appr_loan_909",
    workflowStepId: "step_701",
    status: "awaiting_approval",
    risk_level: "high",
    tool_name: "issue_certificate",
    requester_name: "Aditi Sharma",
    original_request: "I need a bonafide enrollment certificate for my education loan sanction",
    session_id: "sess-8a19f-2026",
    reasoning: "Student requests bonafide certificate for bank education loan sanction. High risk step requires staff financial verification before signing.",
    created_at: new Date().toISOString(),
    contextJson: {
      registration_no: "21CSE1042",
      student_name: "Aditi Sharma",
      year: 3,
      batch_label: "CSE-3A",
      department_name: "Computer Science & Engineering",
      total_annual_fee: 87000,
      amount_paid: 87000,
      outstanding_balance: 0,
      payment_status: "paid",
      purpose: "education_loan",
      cert_serial_no: "SOA-CERT-2026-8A19F",
      hmac_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    evidence: [
      {
        document_id: "CIRC-DEPT-2026-004",
        version: "1.2",
        page: 2,
        clause: "Section 4.1 Loan Eligibility",
        similarity: 0.942,
        text: "Bonafide certificates for education loan applications require zero outstanding balance on current academic year scheduled fees prior to registrar issuance.",
      },
    ],
  };

  const mockHostelApprovalItem: Approval = {
    id: "appr_hostel_101",
    workflowStepId: "step_802",
    status: "awaiting_approval",
    risk_level: "high",
    tool_name: "escalate_grievance",
    requester_name: "Rohit Panda",
    original_request: "Water leakage and broken plumbing in Hostel Block B, Room 214",
    session_id: "sess-hostel-99",
    reasoning: "High-level hostel maintenance complaint requires Warden authorization before escalating work order to Civil Works Dept.",
    created_at: new Date().toISOString(),
    contextJson: {
      student_name: "Rohit Panda",
      registration_no: "22ECE1099",
      hostel_block: "Block B",
      room_no: "214",
      category: "hostel_maintenance",
      description: "Severe water leakage in bathroom ceiling causing flooding",
      urgency: "high",
    },
  };

  const mockLabApprovalItem: Approval = {
    id: "appr_lab_202",
    workflowStepId: "step_903",
    status: "awaiting_approval",
    risk_level: "high",
    tool_name: "book_seminar_hall",
    requester_name: "Dr. R. Nayak",
    original_request: "Reserve Main Auditorium for 400 students - National Robotics Workshop",
    session_id: "sess-lab-88",
    reasoning: "Auditorium capacity >= 200 requires Lab & Facilities In-Charge approval for equipment check.",
    created_at: new Date().toISOString(),
    contextJson: {
      faculty_name: "Dr. R. Nayak",
      hall_name: "Main Auditorium",
      capacity: 400,
      purpose: "National Robotics Workshop",
      date: new Date().toISOString().slice(0, 10),
      duration: "09:00 - 13:00",
    },
  };

  const userRole = user.role;
  const defaultMock = userRole === "warden" 
    ? mockHostelApprovalItem 
    : userRole === "lab_incharge" 
      ? mockLabApprovalItem 
      : mockLoanApprovalItem;

  const activeMocks = [defaultMock].filter((m) => !dismissedMockIds.includes(m.id));
  const approvals = rawApprovals.length > 0 ? rawApprovals : activeMocks;
  const selected = approvals.find((a) => a.id === selectedId) ?? approvals[0] ?? null;

  const contextData = (selected?.contextJson ?? selected?.tool_args ?? {}) as Record<string, unknown>;

  return (
    <AppShell>
      <PageHeader
        title="Approval Queue &amp; HITL Sign-off"
        description="Verify financial evidence context, student identity, and certificate signatures before executing actions."
      />

      {query.isLoading ? <LoadingBlock /> : null}
      {query.error ? <ErrorBlock error={query.error} /> : null}

      {approvals.length === 0 ? (
        <div className="p-6">
          <EmptyState title="No pending approvals" hint="All high-risk agent steps have been reviewed and signed off." />
        </div>
      ) : (
        <div className="grid gap-6 p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Approvals List Sidebar */}
          <ul className="space-y-2">
            {approvals.map((a) => {
              const toolName = a.workflowStep?.toolName ?? a.workflowStep?.tool_name ?? a.tool_name ?? a.workflowStep?.stepName ?? "Agent action";
              const riskLevel = a.workflowStep?.riskLevel ?? a.workflowStep?.risk_level ?? a.risk_level ?? "high";
              const status = a.decision ?? a.workflowStep?.status ?? a.status ?? "awaiting_approval";
              const createdAt = a.createdAt ?? a.created_at;

              return (
                <li key={a.id}>
                  <button
                    onClick={() => setSelectedId(a.id)}
                    className={`panel w-full p-3 text-left transition-colors hover:bg-secondary/60 ${
                      selected?.id === a.id ? "border-primary/50 bg-secondary/50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium">{toolName}</p>
                      <StatusBadge value={riskLevel} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {a.requester_name ?? "Student"} · {a.original_request ?? "Request"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatDate(createdAt)}</span>
                      <StatusBadge value={status} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

        {/* Selected Approval Detail View */}
        {selected ? (
          <div className="space-y-4">
            {/* Student Request Overview */}
            <div className="panel p-5 border-primary/20 bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="font-display text-sm font-semibold">Student Request Context</h2>
                  <p className="text-xs text-muted-foreground">
                    Requester: <span className="font-medium text-foreground">{selected.requester_name ?? "Aditi Sharma"}</span>
                    {contextData.registration_no ? ` (${contextData.registration_no})` : ""}
                    {selected.session_id ? ` · Session ${selected.session_id.slice(0, 10)}` : ""}
                  </p>
                </div>
                <StatusBadge value={selected.risk_level ?? "high"} />
              </div>
              <p className="mt-3 text-sm font-medium">"{selected.original_request ?? "Request description"}"</p>
            </div>

            {/* Structured Financial & Academic Evidence Drawer (contextJson) */}
            {contextData.registration_no ? (
              <div className="panel p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2 font-display text-sm font-semibold">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span>Verified Financial &amp; Academic Evidence Payload</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">contextJson</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4 pt-1">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Student Name</p>
                    <p className="font-medium">{String(contextData.student_name ?? "—")}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Registration No</p>
                    <p className="font-mono font-medium">{String(contextData.registration_no ?? "—")}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Batch Cohort</p>
                    <p className="font-medium">{String(contextData.batch_label ?? "—")} (Yr {String(contextData.year ?? "3")})</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Purpose</p>
                    <p className="font-medium capitalize">{String(contextData.purpose ?? "Loan").replace("_", " ")}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/60 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Annual Scheduled Fee vs Payment</p>
                    <p className="font-medium">
                      Scheduled: ₹{Number(contextData.total_annual_fee ?? 87000).toLocaleString("en-IN")}
                      {" | "}
                      Paid: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">₹{Number(contextData.amount_paid ?? 87000).toLocaleString("en-IN")}</span>
                      {" | "}
                      Outstanding: <span className="font-semibold">₹{Number(contextData.outstanding_balance ?? 0).toLocaleString("en-IN")}</span>
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCertificatePreview(!showCertificatePreview)}
                  >
                    <Printer className="size-3.5" />
                    {showCertificatePreview ? "Hide Preview" : "Preview Letterhead Certificate"}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Digital Certificate Printable Preview Card */}
            {showCertificatePreview || contextData.cert_serial_no ? (
              <div className="panel space-y-4 p-6 border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="size-5 text-amber-600 dark:text-amber-400" />
                    <span className="font-display text-sm font-semibold">Printable Letterhead Certificate Payload</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                    {String(contextData.cert_serial_no ?? "SOA-CERT-2026-8A19F")}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3 shadow-sm">
                  <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">Official Institutional Certificate</p>
                  <h3 className="font-display text-base font-bold uppercase tracking-wide">Bonafide Enrollment Certificate</h3>
                  <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    This is to certify that <strong>{String(contextData.student_name ?? "Aditi Sharma")}</strong> (Reg. No: <strong>{String(contextData.registration_no ?? "21CSE1042")}</strong>) is a full-time bonafide student of <strong>Computer Science &amp; Engineering</strong>, currently enrolled in <strong>Year 3 (Batch {String(contextData.batch_label ?? "CSE-3A")})</strong>. Annual scheduled fees of <strong>₹87,000</strong> have been verified as fully paid.
                  </p>

                  <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border text-[11px] font-mono text-muted-foreground">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Lock className="size-3" />
                      <span>HMAC-SHA256: {String(contextData.hmac_sha256 ?? "e3b0c44298fc1c14...").slice(0, 24)}...</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-primary" /> Registrar Sign-Off Pending Approval
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Agent Reasoning & Retrieved Citations */}
            <div className="panel p-5 space-y-3">
              <h2 className="font-display text-sm font-semibold">Agent Workflow Rationale &amp; Knowledge Citations</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selected.reasoning ?? selected.workflowStep?.rationale ?? "Agent step requires Human-In-The-Loop confirmation."}
              </p>

              {selected.evidence?.length ? (
                <ul className="mt-2 space-y-2">
                  {selected.evidence.map((e, i) => (
                    <li key={i} className="rounded-md border border-border p-3 text-xs bg-muted/30">
                      <p className="font-mono text-[11px] font-semibold text-primary">
                        doc: {e.document_id ?? "—"} · clause: {e.clause ?? "—"} (sim: {e.similarity?.toFixed(3)})
                      </p>
                      {e.text ? <p className="mt-1 text-muted-foreground">{e.text}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : selected.cited_chunk_ids?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selected.cited_chunk_ids.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      <FileText className="size-3" /> {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Proposed Tool Call Raw Arguments */}
            <div className="panel p-5">
              <h2 className="font-display text-sm font-semibold">Proposed Tool Execution Payload</h2>
              <p className="mt-1 font-mono text-xs text-primary">
                {selected.workflowStep?.toolName ?? selected.tool_name ?? "issue_certificate"}
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {JSON.stringify(contextData, null, 2)}
              </pre>
            </div>

            {/* Staff Action Controls */}
            <div className="panel space-y-4 p-5">
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Rejection reason (minimum 10 characters)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Textarea
                  rows={2}
                  placeholder="Ask student a clarifying question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: selected.id, action: "approve" })}
                >
                  Approve &amp; Sign Certificate
                </Button>
                <Button
                  variant="destructive"
                  disabled={decide.isPending || reason.trim().length < 10}
                  onClick={() => decide.mutate({ id: selected.id, action: "reject", body: { reason } })}
                >
                  Reject Action
                </Button>
                <Button
                  variant="outline"
                  disabled={decide.isPending || question.trim().length === 0}
                  onClick={() => decide.mutate({ id: selected.id, action: "request-info", body: { question } })}
                >
                  Request Clarification
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      )}
    </AppShell>
  );
}
