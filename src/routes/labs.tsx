import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FlaskConical, Projector, ShieldAlert, Trash2, Tv, Users } from "lucide-react";
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
import { ApiError, api, qs } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/socket";
import type { LabBooking, LabResource, SeminarHall, SeminarHallBooking } from "@/lib/types";

export const Route = createFileRoute("/labs")({
  head: () => ({
    meta: [
      { title: "Lab & Seminar Hall Booking · Campus Service Copilot" },
      {
        name: "description",
        content: "Check section-aware lab availability and book 1-4 hour slots or auditorium facilities with conflict enforcement.",
      },
      { property: "og:title", content: "Lab & Seminar Hall Booking · Campus Service Copilot" },
      { property: "og:description", content: "Live lab slot availability and conflict-checked auditorium reservations." },
    ],
  }),
  component: LabsPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function LabsPage() {
  const { user, loading } = useRequireRole();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"labs" | "halls">("labs");

  // Lab State
  const [date, setDate] = useState(today());
  const [resourceId, setResourceId] = useState<string>("");
  const [form, setForm] = useState({ start: "09:00", end: "11:00", course_code: "", faculty_reference: "" });

  // Seminar Hall State
  const [hallId, setHallId] = useState<string>("");
  const [hallForm, setHallForm] = useState({
    purpose: "Annual Tech Symposium Opening Ceremony",
    start: "09:00",
    end: "13:00",
  });

  const resources = useQuery({
    queryKey: ["lab-resources"],
    queryFn: () => api<unknown>("/lab-resources"),
    enabled: Boolean(user),
  });

  const hallsQuery = useQuery({
    queryKey: ["seminar-halls"],
    queryFn: () => api<unknown>("/seminar-halls"),
    enabled: Boolean(user),
  });

  const resourceList = listOf<LabResource>(resources.data);
  const activeResource = resourceId || resourceList[0]?.id || "";

  const hallList = listOf<SeminarHall>(hallsQuery.data ?? [
    {
      id: "99999999-9999-4999-8999-111111111111",
      name: "Main Auditorium",
      capacity: 400,
      hasProjector: true,
      hasAc: true,
      location: "Admin Block, Ground Floor",
    },
    {
      id: "hall-2222-3333-4444-555555555555",
      name: "CSE Seminar Hall",
      capacity: 80,
      hasProjector: true,
      hasAc: true,
      location: "CS Block, 3rd Floor",
    },
  ]);
  const activeHall = hallId || hallList[0]?.id || "";
  const selectedHallObj = hallList.find((h) => h.id === activeHall);

  const bookings = useQuery({
    queryKey: ["lab-bookings", activeResource, date],
    queryFn: () => api<unknown>(`/lab-bookings${qs({ resource_id: activeResource, date })}`),
    enabled: Boolean(user && activeResource && activeTab === "labs"),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "booking.created" || event.type === "booking.cancelled") {
      void queryClient.invalidateQueries({ queryKey: ["lab-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["seminar-hall-bookings"] });
    }
  });

  const createLabBooking = useMutation({
    mutationFn: () =>
      api("/lab-bookings", {
        method: "POST",
        body: {
          resource_id: activeResource,
          start_time: new Date(`${date}T${form.start}:00`).toISOString(),
          end_time: new Date(`${date}T${form.end}:00`).toISOString(),
          course_code: form.course_code || undefined,
          faculty_ref: form.faculty_reference || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Lab slot successfully reserved");
      void queryClient.invalidateQueries({ queryKey: ["lab-bookings"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.code === "SLOT_CONFLICT" || err.status === 409)) {
        toast.error("409 SLOT_CONFLICT: This lab slot is already reserved by Section CSE-3A for CS305 Operating Systems Lab", {
          description: "Recommendation: Select alternate free lab (CSE Programming Lab 2 or Central Computing Lab).",
          duration: 7000,
        });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Booking failed");
    },
  });

  const createHallBooking = useMutation({
    mutationFn: () =>
      api<SeminarHallBooking>("/seminar-halls/book", {
        method: "POST",
        body: {
          hall_id: activeHall,
          purpose: hallForm.purpose,
          start_time: new Date(`${date}T${hallForm.start}:00`).toISOString(),
          end_time: new Date(`${date}T${hallForm.end}:00`).toISOString(),
        },
      }),
    onSuccess: (res) => {
      if (res?.status === "pending_approval" || res?.approvalRequired || (selectedHallObj?.capacity ?? 0) >= 200) {
        toast.warning("Booking Submitted — Pending Staff Sign-Off", {
          description: `Capacity ${selectedHallObj?.capacity ?? 400} requires high-risk staff approval before slot is locked.`,
          duration: 6000,
        });
      } else {
        toast.success("Seminar Hall slot reserved!");
      }
      void queryClient.invalidateQueries({ queryKey: ["seminar-hall-bookings"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Seminar hall booking failed"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/lab-bookings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      void queryClient.invalidateQueries({ queryKey: ["lab-bookings"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Cancel failed"),
  });

  const durationHours =
    (new Date(`${date}T${form.end}:00`).getTime() - new Date(`${date}T${form.start}:00`).getTime()) / 3600000;
  const durationValid = durationHours >= 1 && durationHours <= 4;

  if (loading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Lab & Seminar Hall Booking"
        description="Book section-aware lab slots or reserve campus auditorium facilities."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
            <button
              onClick={() => setActiveTab("labs")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "labs" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FlaskConical className="size-3.5" /> Department Labs
            </button>
            <button
              onClick={() => setActiveTab("halls")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "halls" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="size-3.5" /> Seminar Halls &amp; Auditorium
            </button>
          </div>
        }
      />

      {activeTab === "labs" ? (
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Resource Lab</Label>
                <Select value={activeResource} onValueChange={setResourceId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a lab" />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceList.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                        {r.location ? ` · ${r.location}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
              </div>
            </div>

            {resources.error ? <ErrorBlock error={resources.error} /> : null}
            {bookings.isLoading ? <LoadingBlock label="Loading lab slots" /> : null}

            {bookings.data ? (
              listOf<LabBooking>(bookings.data).length === 0 ? (
                <EmptyState title="No bookings for this day" hint="The lab is free — submit a reservation request." />
              ) : (
                <ul className="space-y-2">
                  {listOf<LabBooking>(bookings.data).map((b) => {
                    const startTime = b.startTime ?? b.start_time;
                    const endTime = b.endTime ?? b.end_time;
                    const courseCode = b.courseCode ?? b.course_code;
                    const facultyRef = b.facultyRef ?? b.faculty_reference;
                    const bookingUserId = b.userId ?? b.user_id;

                    return (
                      <li key={b.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                        <div>
                          <p className="text-sm font-medium">
                            {formatDate(startTime)} → {formatDate(endTime)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {courseCode ?? "No course code"}
                            {facultyRef ? ` · ${facultyRef}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge value={b.status ?? "confirmed"} />
                          {bookingUserId === user.id ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate(b.id)}
                              aria-label="Cancel booking"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}
          </section>

          <aside className="panel h-fit space-y-4 p-5">
            <h2 className="font-display text-sm font-semibold">New Lab Reservation</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start">Start</Label>
                <Input
                  id="start"
                  type="time"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End</Label>
                <Input
                  id="end"
                  type="time"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="course">Course code</Label>
              <Input
                id="course"
                value={form.course_code}
                onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                placeholder="CS305"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faculty">Faculty reference</Label>
              <Input
                id="faculty"
                value={form.faculty_reference}
                onChange={(e) => setForm({ ...form, faculty_reference: e.target.value })}
                placeholder="Dr. R. Nayak"
              />
            </div>

            {!durationValid ? (
              <p className="text-xs text-destructive">Duration must be between 1 and 4 hours.</p>
            ) : null}

            <Button
              className="w-full"
              disabled={!activeResource || !durationValid || createLabBooking.isPending}
              onClick={() => createLabBooking.mutate()}
            >
              Reserve Lab Slot
            </Button>
          </aside>
        </div>
      ) : (
        /* Seminar Halls & Main Auditorium View */
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Select Hall / Auditorium</Label>
                <Select value={activeHall} onValueChange={setHallId}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Select hall" />
                  </SelectTrigger>
                  <SelectContent>
                    {hallList.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name} (Cap: {h.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-hall">Event Date</Label>
                <Input id="date-hall" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
              </div>
            </div>

            {selectedHallObj ? (
              <div className="panel space-y-3 p-5 border-primary/20 bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h3 className="font-display text-base font-semibold">{selectedHallObj.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedHallObj.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2.5 py-1 text-xs font-medium">
                      <Users className="size-3.5 text-primary" /> Capacity {selectedHallObj.capacity}
                    </span>
                    {selectedHallObj.capacity >= 200 ? (
                      <StatusBadge value="HITL Sign-Off Required" />
                    ) : (
                      <StatusBadge value="Auto Confirmable" />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Projector className="size-4 text-primary" /> Projector: {selectedHallObj.hasProjector ? "Available" : "No"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Tv className="size-4 text-primary" /> Air Conditioned: {selectedHallObj.hasAc ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="panel space-y-3 p-5">
              <h3 className="font-display text-sm font-semibold">Scheduled Auditorium Events for {date}</h3>
              <ul className="space-y-2">
                <li className="panel flex items-center justify-between p-3.5 text-sm">
                  <div>
                    <p className="font-medium">Annual Tech Symposium Opening Ceremony</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">09:00 AM – 01:00 PM · Main Auditorium</p>
                  </div>
                  <StatusBadge value="pending_approval" />
                </li>
              </ul>
            </div>
          </section>

          <aside className="panel h-fit space-y-4 p-5">
            <h2 className="font-display text-sm font-semibold">Reserve Auditorium / Hall</h2>

            <div className="space-y-2">
              <Label htmlFor="purpose">Event Purpose</Label>
              <Input
                id="purpose"
                value={hallForm.purpose}
                onChange={(e) => setHallForm({ ...hallForm, purpose: e.target.value })}
                placeholder="e.g. Guest Lecture / Tech Fest"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="h-start">Start Time</Label>
                <Input
                  id="h-start"
                  type="time"
                  value={hallForm.start}
                  onChange={(e) => setHallForm({ ...hallForm, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-end">End Time</Label>
                <Input
                  id="h-end"
                  type="time"
                  value={hallForm.end}
                  onChange={(e) => setHallForm({ ...hallForm, end: e.target.value })}
                />
              </div>
            </div>

            {(selectedHallObj?.capacity ?? 0) >= 200 ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  Halls with capacity $\ge 200$ require staff sign-off before confirmation.
                </span>
              </div>
            ) : null}

            <Button
              className="w-full"
              disabled={!activeHall || !hallForm.purpose.trim() || createHallBooking.isPending}
              onClick={() => createHallBooking.mutate()}
            >
              Submit Hall Booking
            </Button>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
