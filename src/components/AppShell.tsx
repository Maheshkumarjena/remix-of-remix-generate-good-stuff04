import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  ClipboardList,
  FileSearch,
  FlaskConical,
  Gavel,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Library,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const studentNav: NavItem[] = [
  { to: "/chat", label: "Copilot", icon: <MessageSquare className="size-4" /> },
  { to: "/requests", label: "My Requests", icon: <ClipboardList className="size-4" /> },
  { to: "/labs", label: "Lab Booking", icon: <FlaskConical className="size-4" /> },
  { to: "/grievances", label: "Grievances", icon: <Gavel className="size-4" /> },
  { to: "/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  { to: "/settings", label: "Settings", icon: <Settings className="size-4" /> },
];

const staffNav: NavItem[] = [
  { to: "/staff", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { to: "/staff/approvals", label: "Approvals", icon: <ShieldCheck className="size-4" /> },
  { to: "/staff/requests", label: "Requests", icon: <ClipboardList className="size-4" /> },
  { to: "/staff/kb", label: "Knowledge Base", icon: <Library className="size-4" /> },
  { to: "/labs", label: "Lab Booking", icon: <FlaskConical className="size-4" /> },
  { to: "/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  { to: "/settings", label: "Settings", icon: <Settings className="size-4" /> },
];

const adminNav: NavItem[] = [
  { to: "/admin", label: "Governance", icon: <LayoutDashboard className="size-4" /> },
  { to: "/admin/audit", label: "Audit Explorer", icon: <FileSearch className="size-4" /> },
  { to: "/admin/policy-conflicts", label: "Policy Conflicts", icon: <ScrollText className="size-4" /> },
  { to: "/admin/kb", label: "Knowledge Base", icon: <Library className="size-4" /> },
  { to: "/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  { to: "/settings", label: "Settings", icon: <Settings className="size-4" /> },
];

export function navForRole(role: Role | undefined): NavItem[] {
  if (role === "admin") return adminNav;
  if (role === "staff" || role === "warden" || role === "lab_incharge") return staffNav;
  return studentNav;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = navForRole(user?.role);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
          <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">Campus Copilot</p>
            <p className="text-xs text-sidebar-foreground/60">Service Operations</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {user?.role?.replace("_", " ")} {user?.department ? `· ${user.department}` : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </header>
        <main className="min-w-0 flex-1">{children}</main>
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
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-card px-6 py-5">
      <div>
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
