import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, CreditCard, FileCheck, GraduationCap, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge, LoadingBlock } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import type { AnnualFeeSummary, ExamRecord, StudentProfile } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Profile & Academic Record · Campus Service Copilot" },
      {
        name: "description",
        content: "Manage your campus copilot profile, academic standing, annual fee status and exam records.",
      },
      { property: "og:title", content: "Profile & Academic Record · Campus Service Copilot" },
      { property: "og:description", content: "Academic identity, fee breakdown, exam marks and preferences." },
    ],
  }),
  component: SettingsPage,
});

const languages = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "or", label: "Odia" },
];

const prefKeys = [
  { key: "email", label: "Email notifications" },
  { key: "push", label: "Push notifications" },
  { key: "sms", label: "SMS notifications" },
];

function SettingsPage() {
  const { user, loading } = useRequireRole();
  const { logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState(user?.preferred_language ?? "en");
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    user?.notification_prefs ?? user?.notification_preferences ?? { email: true },
  );
  const [saving, setSaving] = useState(false);

  const isStudent = user?.role === "student";

  const studentProfileQuery = useQuery({
    queryKey: ["student-profile", user?.id],
    queryFn: () => api<StudentProfile>("/students/me/profile"),
    enabled: Boolean(user && isStudent),
  });

  const feeSummaryQuery = useQuery({
    queryKey: ["annual-fee-summary", user?.id],
    queryFn: () => api<AnnualFeeSummary>("/students/me/annual-fee-summary?year=3"),
    enabled: Boolean(user && isStudent),
  });

  const examRecordsQuery = useQuery({
    queryKey: ["exam-records", user?.id],
    queryFn: () => api<ExamRecord[]>("/students/me/exam-records"),
    enabled: Boolean(user && isStudent),
  });

  const save = async () => {
    setSaving(true);
    try {
      await api("/users/me", {
        method: "PATCH",
        body: { preferred_language: language, notification_prefs: prefs },
      });
      await refreshUser();
      toast.success("Preferences saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  // Fallback defaults for demo display if backend endpoint unavailable
  const profileData: Partial<StudentProfile> = studentProfileQuery.data ?? {
    registrationNo: user.email.includes("ece") ? "22ECE1005" : "21CSE1042",
    rollNo: user.email.includes("ece") ? "ECE2A-05" : "CSE3A-14",
    name: user.name,
    departmentName: user.department ?? (user.email.includes("ece") ? "Electronics & Communication Engg" : "Computer Science & Engineering"),
    sectionName: user.email.includes("ece") ? "Section A (ECE-2A)" : "Section A (CSE-3A)",
    batchLabel: user.email.includes("ece") ? "ECE-2A" : "CSE-3A",
    year: user.email.includes("ece") ? 2 : 3,
    semester: user.email.includes("ece") ? 3 : 5,
    admissionYear: user.email.includes("ece") ? 2022 : 2021,
    status: "active",
  };

  const feeData: Partial<AnnualFeeSummary> = feeSummaryQuery.data ?? (
    user.email.includes("ece") || user.name.includes("Rohit")
      ? {
          academicYear: 2,
          totalTuitionFee: 75000,
          totalHostelFee: 10000,
          totalExamFee: 2000,
          totalAnnualScheduledFee: 87000,
          totalAmountPaid: 0,
          outstandingBalance: 87000,
          isFullyPaid: false,
          paymentStatus: "unpaid",
          recentReceiptNo: null,
        }
      : {
          academicYear: 3,
          totalTuitionFee: 75000,
          totalHostelFee: 10000,
          totalExamFee: 2000,
          totalAnnualScheduledFee: 87000,
          totalAmountPaid: 87000,
          outstandingBalance: 0,
          isFullyPaid: true,
          paymentStatus: "paid",
          recentReceiptNo: "RCPT-2026-004521",
        }
  );

  const examData: ExamRecord[] = (examRecordsQuery.data as ExamRecord[] | undefined) ?? [
    {
      id: "exam-1",
      subjectCode: "CS301",
      subjectName: "Database Management Systems",
      examType: "mid_sem",
      marksObtained: 38,
      maxMarks: 50,
      status: "published",
      publishedAt: "2026-08-10T10:00:00Z",
    },
    {
      id: "exam-2",
      subjectCode: "CS305",
      subjectName: "Operating Systems",
      examType: "mid_sem",
      marksObtained: 44,
      maxMarks: 50,
      status: "published",
      publishedAt: "2026-08-12T10:00:00Z",
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title={isStudent ? "Academic Identity & Profile" : "Profile & Settings"}
        description="View institutional records, annual fee schedules, and personal preferences."
      />

      <div className="grid max-w-4xl gap-6 p-6">
        {/* Student Identity Card */}
        {isStudent ? (
          <div className="panel space-y-4 p-5 border-primary/30 bg-card">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-display text-sm font-semibold">
                <GraduationCap className="size-5 text-primary" />
                <span>Student Institutional Identity</span>
              </div>
              <StatusBadge value={profileData.status ?? "active"} />
            </div>

            {studentProfileQuery.isLoading ? (
              <LoadingBlock label="Fetching student identity record..." />
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <Row label="Registration No" value={profileData.registrationNo ?? "—"} />
                <Row label="Roll No" value={profileData.rollNo ?? "—"} />
                <Row label="Batch Cohort" value={profileData.batchLabel ?? "—"} />
                <Row label="Department" value={profileData.departmentName ?? "—"} />
                <Row label="Academic Year" value={`Year ${profileData.year ?? "—"} (Sem ${profileData.semester ?? "—"})`} />
                <Row label="Admission Year" value={String(profileData.admissionYear ?? "—")} />
              </div>
            )}
          </div>
        ) : null}

        {/* Financial & Education Loan Fee Breakdown Card */}
        {isStudent ? (
          <div className="panel space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-display text-sm font-semibold">
                <CreditCard className="size-5 text-primary" />
                <span>Annual Fee Schedule &amp; Loan Sanction Status (Year {feeData.academicYear ?? 3})</span>
              </div>
              <StatusBadge value={feeData.paymentStatus ?? "unpaid"} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Row label="Tuition Fee" value={`₹${feeData.totalTuitionFee?.toLocaleString("en-IN") ?? "0"}`} />
              <Row label="Hostel Fee" value={`₹${feeData.totalHostelFee?.toLocaleString("en-IN") ?? "0"}`} />
              <Row label="Exam Fee" value={`₹${feeData.totalExamFee?.toLocaleString("en-IN") ?? "0"}`} />
              <Row label="Scheduled Total" value={`₹${feeData.totalAnnualScheduledFee?.toLocaleString("en-IN") ?? "0"}`} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted/60 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment Summary</p>
                <p className="mt-1 text-sm font-medium">
                  Paid: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">₹{feeData.totalAmountPaid?.toLocaleString("en-IN")}</span>
                  {" · "}
                  Outstanding: <span className={feeData.outstandingBalance! > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>₹{feeData.outstandingBalance?.toLocaleString("en-IN")}</span>
                </p>
                {feeData.recentReceiptNo ? (
                  <p className="mt-1 text-xs font-mono text-muted-foreground">Receipt #: {feeData.recentReceiptNo}</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                {feeData.isFullyPaid ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/chat">
                      <FileCheck className="size-3.5" /> Apply for Loan Certificate
                    </Link>
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" asChild>
                    <Link to="/chat">
                      <ShieldAlert className="size-3.5" /> Pay Balance Outstanding
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Academic Marks & Grievance Re-evaluation Card */}
        {isStudent ? (
          <div className="panel space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-display text-sm font-semibold">
                <Award className="size-5 text-primary" />
                <span>Academic Examination Records</span>
              </div>
              <span className="text-xs text-muted-foreground">Semester 5 Mid-Sem</span>
            </div>

            <div className="space-y-3">
              {examData.map((record) => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {record.subjectCode}: {record.subjectName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                      {record.examType.replace("_", " ")} · Published: {record.publishedAt ? new Date(record.publishedAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold">
                      {record.marksObtained} / {record.maxMarks}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/grievances">
                        Request Re-evaluation
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Basic User Account Card */}
        <div className="panel space-y-3 p-5 text-sm">
          <h2 className="font-display text-sm font-semibold">Account Information</h2>
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Role" value={user.role.replace("_", " ")} />
          <Row label="Department" value={user.department ?? user.department_id ?? "—"} />
        </div>

        {/* Language & Notifications Preferences */}
        <div className="panel space-y-4 p-5">
          <h2 className="font-display text-sm font-semibold">Preferences</h2>
          <div className="space-y-2">
            <Label>Preferred language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {prefKeys.map((p) => (
              <div key={p.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor={p.key} className="text-sm font-normal">
                  {p.label}
                </Label>
                <Switch
                  id={p.key}
                  checked={prefs[p.key] ?? false}
                  onCheckedChange={(v) => setPrefs({ ...prefs, [p.key]: v })}
                />
              </div>
            ))}
          </div>

          <Button onClick={() => void save()} disabled={saving}>
            Save preferences
          </Button>
        </div>

        {/* Session Card */}
        <div className="panel space-y-3 p-5">
          <h2 className="font-display text-sm font-semibold">Session Management</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                await navigate({ to: "/" });
              }}
            >
              Sign out
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await api("/auth/logout", { method: "POST", body: { all_devices: true } });
                } catch {
                  /* ignore */
                }
                await logout();
                await navigate({ to: "/" });
              }}
            >
              Sign out of all devices
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="capitalize">{value}</span>
    </div>
  );
}
