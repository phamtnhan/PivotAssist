"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
  role: "CANDIDATE" | "RECRUITER" | "ADMIN";
}

export type UserContextValue = {
  user: UserSession | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  initials: string;
  displayName: string;
};

export const UserContext = createContext<UserContextValue | null>(null);

function getInitials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function readCachedUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("pivotassist:user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSession;
    if (!parsed?.userId || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedUser(user: UserSession | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.sessionStorage.removeItem("pivotassist:user");
    return;
  }
  window.sessionStorage.setItem("pivotassist:user", JSON.stringify(user));
}

export function useUserState(initialUser: UserSession | null = null): UserContextValue {
  const [user, setUser] = useState<UserSession | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          writeCachedUser(data.user);
        } else {
          setUser(null);
          writeCachedUser(null);
        }
      } else {
        setUser(null);
        writeCachedUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialUser) {
      const cached = readCachedUser();
      if (cached) {
        setUser(cached);
        setIsLoading(false);
      }
    }
    void fetchUser();
  }, [fetchUser, initialUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setUser(null);
      writeCachedUser(null);
      window.location.href = "/";
    }
  }, []);

  return useMemo<UserContextValue>(
    () => ({
      user,
      isLoading,
      refreshUser: fetchUser,
      logout,
      initials: user ? getInitials(user.fullName || user.email) : isLoading ? "" : "U",
      displayName: user?.fullName?.trim() || user?.email?.split("@")[0] || "",
    }),
    [user, isLoading, fetchUser, logout],
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
