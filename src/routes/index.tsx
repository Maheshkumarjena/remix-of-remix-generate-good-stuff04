import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/api";
import { homeForRole, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in · Campus Service Copilot" },
      {
        name: "description",
        content:
          "Sign in to the Campus Service Copilot to raise requests, chat with the campus agent and review approvals.",
      },
      { property: "og:title", content: "Sign in · Campus Service Copilot" },
      {
        property: "og:description",
        content: "Access the agentic campus service desk for students, staff and administrators.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: homeForRole(user.role) });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const me = await login(email, password);
      await navigate({ to: homeForRole(me.role) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="surface-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-5" />
          </span>
          <span className="font-display text-base font-semibold">Campus Service Copilot</span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h2 className="font-display text-3xl font-semibold leading-tight">
            One agentic desk for certificates, hostel, labs and grievances.
          </h2>
          <ul className="space-y-4 text-sm text-sidebar-foreground/75">
            <li className="flex gap-3">
              <Sparkles className="mt-0.5 size-4 text-sidebar-primary" />
              Policy-grounded answers with citations from institutional documents.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 text-sidebar-primary" />
              High-risk actions pause for staff approval and land in a hash-chained audit trail.
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">API base: {API_BASE_URL}</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-display text-2xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Students, staff, wardens, lab in-charges and admins.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@campus.edu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Need a demo account?{" "}
            <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
