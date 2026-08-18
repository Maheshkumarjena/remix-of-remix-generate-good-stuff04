import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import type { LabBooking, LabResource } from "@/lib/types";

export const Route = createFileRoute("/labs")({
  head: () => ({
    meta: [
      { title: "Lab Booking · Campus Service Copilot" },
      {
        name: "description",
        content: "Check lab availability and book 1 to 4 hour slots with course code and faculty reference.",
      },
      { property: "og:title", content: "Lab Booking · Campus Service Copilot" },
      { property: "og:description", content: "Live lab slot availability and conflict-checked bookings." },
    ],
  }),
  component: LabsPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function LabsPage() {
  const { user, loading } = useRequireRole();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today());
  const [resourceId, setResourceId] = useState<string>("");
  const [form, setForm] = useState({ start: "09:00", end: "11:00", course_code: "", faculty_reference: "" });

  const resources = useQuery({
    queryKey: ["lab-resources"],
    queryFn: () => api<unknown>("/lab-resources"),
    enabled: Boolean(user),
  });

  const resourceList = listOf<LabResource>(resources.data);
  const activeResource = resourceId || resourceList[0]?.id || "";

  const bookings = useQuery({
    queryKey: ["lab-bookings", activeResource, date],
    queryFn: () => api<unknown>(`/lab-bookings${qs({ resource_id: activeResource, date })}`),
    enabled: Boolean(user && activeResource),
  });

  useRealtime(authUser?.id, (event) => {
    if (event.type === "booking.created" || event.type === "booking.cancelled")
      void queryClient.invalidateQueries({ queryKey: ["lab-bookings"] });
  });

  const create = useMutation({
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
      toast.success("Slot booked");
      void queryClient.invalidateQueries({ queryKey: ["lab-bookings"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "SLOT_CONFLICT") {
        toast.error("That slot conflicts with an existing booking");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Booking failed");
    },
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
      <PageHeader title="Lab Booking" description="Bookings must be between 1 and 4 hours." />

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Resource</Label>
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
          {bookings.isLoading ? <LoadingBlock label="Loading slots" /> : null}

          {bookings.data ? (
            listOf<LabBooking>(bookings.data).length === 0 ? (
              <EmptyState title="No bookings for this day" hint="The lab is free — book a slot on the right." />
            ) : (
              <ul className="space-y-2">
                {listOf<LabBooking>(bookings.data).map((b) => (
                  <li key={b.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {formatDate(b.start_time)} → {formatDate(b.end_time)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {b.course_code ?? "No course code"}
                        {b.faculty_reference ? ` · ${b.faculty_reference}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={b.status ?? "booked"} />
                      {b.user_id === user.id ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancel.mutate(b.id)}
                          aria-label="Cancel booking"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>

        <aside className="panel h-fit space-y-4 p-5">
          <h2 className="font-display text-sm font-semibold">New booking</h2>
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
              placeholder="CS-3021"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faculty">Faculty reference</Label>
            <Input
              id="faculty"
              value={form.faculty_reference}
              onChange={(e) => setForm({ ...form, faculty_reference: e.target.value })}
              placeholder="Dr. Mishra"
            />
          </div>

          {!durationValid ? (
            <p className="text-xs text-destructive">Duration must be between 1 and 4 hours.</p>
          ) : null}

          <Button
            className="w-full"
            disabled={!activeResource || !durationValid || create.isPending}
            onClick={() => create.mutate()}
          >
            Book slot
          </Button>
        </aside>
      </div>
    </AppShell>
  );
}
