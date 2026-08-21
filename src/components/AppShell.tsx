import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  FileSearch,
  FlaskConical,
  Gavel,
  LayoutDashboard,
  Library,
  LogOut,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getDepartmentName } from "@/lib/departments";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const studentNav: NavItem[] = [
  { to: "/chat", label: "Copilot Chat", icon: <MessageSquare className="size-4" /> },
  { to: "/requests", label: "My Requests", icon: <ClipboardList className="size-4" /> },
  { to: "/labs", label: "Lab & Hall Booking", icon: <FlaskConical className="size-4" /> },
  { to: "/grievances", label: "Grievances", icon: <Gavel className="size-4" /> },
  { to: "/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  { to: "/settings", label: "Academic Profile & Settings", icon: <Settings className="size-4" /> },
];

const staffNav: NavItem[] = [
  { to: "/staff", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { to: "/staff/approvals", label: "Approvals Queue", icon: <ShieldCheck className="size-4" /> },
  { to: "/staff/requests", label: "Requests", icon: <ClipboardList className="size-4" /> },
  { to: "/staff/kb", label: "Knowledge Base", icon: <Library className="size-4" /> },
  { to: "/labs", label: "Lab & Hall Booking", icon: <FlaskConical className="size-4" /> },
  { to: "/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  { to: "/settings", label: "Settings", icon: <Settings className="size-4" /> },
];

const adminNav: NavItem[] = [
  { to: "/admin", label: "Governance Overview", icon: <LayoutDashboard className="size-4" /> },
  { to: "/admin/audit", label: "Audit Explorer", icon: <FileSearch className="size-4" /> },
  { to: "/admin/policy-conflicts", label: "Policy Conflicts", icon: <ScrollText className="size-4" /> },
  { to: "/admin/kb", label: "Knowledge Base", icon: <Library className="size-4" /> },
  { to: "/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  { to: "/settings", label: "System Settings", icon: <Settings className="size-4" /> },
];

export function navForRole(role: Role | undefined): NavItem[] {
  if (role === "admin") return adminNav;
  if (role === "staff" || role === "warden" || role === "lab_incharge") return staffNav;
  return studentNav;
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profileOpen, setProfileOpen] = useState(false);

  const nav = navForRole(user?.role);
  const initials = getInitials(user?.name);
  const deptName = user?.department_id ? getDepartmentName(user.department_id) : user?.department ?? "";
  const roleLabel = (user?.role ?? "user").replace(/_/g, " ");

  return (
    <div className="flex min-h-screen flex-col bg-background antialiased">
      {/* Top Application Header Bar */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/80 bg-card/95 px-4 backdrop-blur-md md:px-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Building2 className="size-4" />
            </span>
            <div className="leading-none">
              <span className="font-display text-base font-semibold tracking-tight">Campus Copilot</span>
              <span className="ml-2 hidden rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400 md:inline-block">
                ● Live API Connected
              </span>
            </div>
          </Link>
        </div>

        {/* User Profile & Action Menu */}
        <div className="relative flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-xs font-semibold text-foreground">{user?.name ?? "Authenticated User"}</p>
            <p className="text-[11px] capitalize text-muted-foreground">
              {roleLabel} {deptName ? `· ${deptName}` : ""}
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 p-1 text-sm transition-all hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground mr-1" />
            </button>

            {profileOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border/80 bg-card p-2 shadow-xl backdrop-blur-lg">
                  <div className="border-b border-border/60 pb-2 px-3 pt-1">
                    <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium capitalize text-primary">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      <Settings className="size-3.5 text-muted-foreground" /> Settings & Profile
                    </Link>
                  </div>
                  <div className="border-t border-border/60 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        void logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="size-3.5" /> Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 min-w-0">
        {/* Desktop Sidebar Navigation */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-r border-border bg-card/60 p-3 md:flex">
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {nav.map((item) => {
              const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(`${item.to}/`));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border/60 pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void logout()}
            >
              <LogOut className="size-3.5" /> Sign out
            </Button>
          </div>
        </aside>

        {/* Content Area wrapped in ErrorBoundary */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile Horizontal Navigation Header */}
          <header className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card/40 px-4 py-2 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                activeProps={{ className: "bg-primary text-primary-foreground shadow-sm" }}
              >
                {item.label}
              </Link>
            ))}
          </header>

          <main className="min-w-0 flex-1">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-card/60 px-6 py-5">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
