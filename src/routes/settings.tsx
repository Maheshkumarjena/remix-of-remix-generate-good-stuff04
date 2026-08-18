import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
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

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Profile & Settings · Campus Service Copilot" },
      {
        name: "description",
        content: "Manage your campus copilot profile, preferred language and notification preferences.",
      },
      { property: "og:title", content: "Profile & Settings · Campus Service Copilot" },
      { property: "og:description", content: "Language and notification preferences for the campus copilot." },
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

  return (
    <AppShell>
      <PageHeader title="Profile & Settings" description="Your account and how the copilot reaches you." />

      <div className="grid max-w-3xl gap-6 p-6">
        <div className="panel space-y-3 p-5 text-sm">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Role" value={user.role.replace("_", " ")} />
          <Row label="Department" value={user.department ?? "—"} />
        </div>

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

        <div className="panel space-y-3 p-5">
          <h2 className="font-display text-sm font-semibold">Session</h2>
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
