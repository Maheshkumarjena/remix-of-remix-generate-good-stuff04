import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { api, setAccessToken } from "./api";
import type { Role, User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  department_id?: string;
  preferred_language?: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function homeForRole(role: Role | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "staff" || role === "warden" || role === "lab_incharge") return "/staff";
  return "/chat";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const me = await api<User>("/users/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await api<User>("/users/me");
        if (active) setUser(me);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refreshUser,
      login: async (email, password) => {
        const res = await api<{ user: User; access_token?: string }>("/auth/login", {
          method: "POST",
          body: { email, password },
        });
        if (res.access_token) setAccessToken(res.access_token);
        setUser(res.user);
        return res.user;
      },
      register: async (payload) => {
        await api("/auth/register", { method: "POST", body: payload });
      },
      logout: async () => {
        try {
          await api("/auth/logout", { method: "POST" });
        } catch {
          /* ignore */
        }
        setAccessToken(null);
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Redirects to /login when unauthenticated, or home when the role is wrong. */
export function useRequireRole(roles?: Role[]) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/" });
      return;
    }
    if (roles && !roles.includes(user.role)) {
      void navigate({ to: homeForRole(user.role) });
    }
  }, [user, loading, roles, navigate]);

  return { user, loading };
}
