"use client";

import { useEffect, useState } from "react";
import { AdminAppShell } from "@/components/AdminAppShell";
import {
  Users,
  MagnifyingGlass,
  CheckCircle,
  WarningCircle,
  Plus,
  Lock,
  LockOpen,
  Sparkle,
  TrendUp,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { adminUsersCopy } from "@/lib/i18n-admin";
import { fillCopy } from "@/lib/i18n-enterprise";
import { apiErrorText } from "@/lib/api-errors";

type PlanCode = "starter" | "pro" | "master" | "free";
type UserRole = "CANDIDATE" | "RECRUITER" | "ADMIN";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: PlanCode;
  remainingSessions: number;
  avgScore: number;
  status: "active" | "locked";
  joinedDate: string;
}

function planCode(plan: unknown): PlanCode {
  if (plan === "pro") return "pro";
  if (plan === "master") return "master";
  if (plan === "starter") return "starter";
  return "free";
}

function userRole(role: unknown): UserRole {
  if (role === "RECRUITER") return "RECRUITER";
  if (role === "ADMIN") return "ADMIN";
  return "CANDIDATE";
}

export default function AdminUsersPage() {
  const { locale } = useLocale();
  const copy = adminUsersCopy(locale);
  const planLabel = (plan: PlanCode) =>
    plan === "pro"
      ? copy.planPro
      : plan === "master"
        ? copy.planMaster
        : plan === "starter"
          ? copy.planStarter
          : copy.planFree;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (cancelled || !response?.ok || !payload?.success) return;
      setUsers(
        (payload.users ?? []).map(
          (item: {
            id: string;
            fullName: string;
            email: string;
            role: string;
            isActive: boolean;
            createdAt: string;
            preferencesJson?: unknown;
            _count?: { interviews?: number };
          }) => {
            const preferences =
              item.preferencesJson &&
              typeof item.preferencesJson === "object" &&
              !Array.isArray(item.preferencesJson)
                ? (item.preferencesJson as { remainingSessions?: number; plan?: string })
                : {};
            return {
              id: item.id,
              name: item.fullName,
              email: item.email,
              role: userRole(item.role),
              plan: planCode(preferences.plan),
              remainingSessions: Number(preferences.remainingSessions ?? 0),
              avgScore: item._count?.interviews ?? 0,
              status: item.isActive ? "active" : "locked",
              joinedDate: new Date(item.createdAt).toLocaleDateString(
                locale === "en" ? "en-GB" : "vi-VN",
              ),
            };
          },
        ),
      );
      const nextTotalPages = Math.max(1, Number(payload.totalPages ?? 1));
      setTotalPages(nextTotalPages);
      setTotalUsers(Number(payload.total ?? 0));
      if (page > nextTotalPages) setPage(nextTotalPages);
      setLiveMode(true);
    }
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [locale, page, search]);

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = selectedPlan === "all" || u.plan === selectedPlan;
    return matchesSearch && matchesPlan;
  });

  const toggleUserStatus = async (id: string) => {
    const target = users.find((user) => user.id === id);
    if (!target) return;
    const nextStatus = target.status === "active" ? "locked" : "active";
    const previousUsers = [...users];

    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));

    if (liveMode) {
      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id, isActive: nextStatus === "active" }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          setUsers(previousUsers);
          showToast(apiErrorText(payload, locale, copy.fail), true);
          return;
        }
      } catch {
        setUsers(previousUsers);
        showToast(copy.fail, true);
        return;
      }
    }
    showToast(
      nextStatus === "locked"
        ? fillCopy(copy.lockedMsg, { name: target.name })
        : fillCopy(copy.unlockedMsg, { name: target.name }),
    );
  };

  const handleGrantSessions = async (id: string) => {
    const target = users.find((user) => user.id === id);
    if (!target) return;
    const previousUsers = [...users];

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, remainingSessions: u.remainingSessions + 5 } : u)),
    );

    if (liveMode) {
      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id, grantSessions: 5 }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          setUsers(previousUsers);
          showToast(apiErrorText(payload, locale, copy.fail), true);
          return;
        }
      } catch {
        setUsers(previousUsers);
        showToast(copy.fail, true);
        return;
      }
    }
    showToast(fillCopy(copy.grantedMsg, { name: target.name }));
  };

  const handleRoleChange = async (id: string, nextRole: UserRole) => {
    const target = users.find((user) => user.id === id);
    if (!target || target.role === nextRole) return;
    const previousUsers = [...users];
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, role: nextRole } : user)));
    if (liveMode) {
      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id, role: nextRole }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          setUsers(previousUsers);
          showToast(apiErrorText(payload, locale, copy.fail), true);
          return;
        }
      } catch {
        setUsers(previousUsers);
        showToast(copy.fail, true);
        return;
      }
    }
    showToast(fillCopy(copy.roleChangedMsg, { name: target.name }));
  };

  return (
    <AdminAppShell>
      <div className="max-w-[1240px] mx-auto font-sans space-y-6 pb-20">
        {/* Header */}
        <div className="border-b border-[rgba(33,34,38,0.06)] pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#1A73E8] uppercase tracking-wider mb-1">
              <Users size={14} weight="fill" />
              <span>{copy.eyebrow}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-sans font-[450] text-[#121317] tracking-[-0.02em]">
              {copy.title}
            </h1>
            <p className="text-[13.5px] text-[#45474D] mt-1 font-normal">{copy.lead}</p>
          </div>

          {toast && (
            <div
              className={cn(
                "animate-in fade-in slide-in-from-top-2 duration-200 px-4 py-2 rounded-full text-[12.5px] font-[450] flex items-center gap-2 shadow-xs",
                toast.isError
                  ? "bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F]"
                  : "bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333]",
              )}
            >
              {toast.isError ? (
                <WarningCircle size={15} weight="fill" />
              ) : (
                <CheckCircle size={15} weight="fill" />
              )}
              <span>{toast.message}</span>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-md">
              <MagnifyingGlass
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45474D]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={copy.search}
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.12)] rounded-full pl-9 pr-4 py-2 text-[13px] text-[#121317] placeholder:text-[#45474D] focus:outline-none focus:border-[#1A73E8] transition-all"
              />
            </div>

            <select
              value={selectedPlan}
              onChange={(e) => {
                setSelectedPlan(e.target.value);
                setPage(1);
              }}
              className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.12)] rounded-full px-4 py-2 text-[12.5px] text-[#121317] focus:outline-none focus:border-[#1A73E8] cursor-pointer"
            >
              <option value="all">{copy.allPlans}</option>
              <option value="starter">{copy.planStarter}</option>
              <option value="pro">{copy.planPro}</option>
              <option value="master">{copy.planMaster}</option>
              <option value="free">{copy.planFree}</option>
            </select>
          </div>

          <div className="text-[12.5px] text-[#45474D] font-[450] shrink-0">
            {copy.showing}:{" "}
            <strong className="text-[#121317] font-mono">{filteredUsers.length}</strong> /{" "}
            {totalUsers} {copy.accounts}
          </div>
        </div>

        {/* Table in Clean Antigravity Card */}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-[#F8F9FA]/80 border-b border-[rgba(33,34,38,0.06)] text-[#45474D] text-[11px] font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-6">{copy.colUser}</th>
                  <th className="py-3.5 px-4">{copy.colRole}</th>
                  <th className="py-3.5 px-4">{copy.colPlan}</th>
                  <th className="py-3.5 px-4">{copy.colLeft}</th>
                  <th className="py-3.5 px-4">{copy.colScore}</th>
                  <th className="py-3.5 px-4">{copy.colStatus}</th>
                  <th className="py-3.5 px-6 text-right">{copy.colAct}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(33,34,38,0.06)]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F8F9FA]/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-[450] text-[14px] text-[#121317]">{u.name}</div>
                      <div className="text-[12px] text-[#45474D] font-normal">{u.email}</div>
                    </td>

                    <td className="py-4 px-4">
                      <select
                        value={u.role}
                        onChange={(event) =>
                          void handleRoleChange(u.id, event.target.value as UserRole)
                        }
                        aria-label={`${copy.colRole}: ${u.name}`}
                        className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.12)] rounded-full px-2.5 py-1 text-[11.5px] text-[#121317] focus:outline-none focus:border-[#1A73E8] cursor-pointer"
                      >
                        <option value="CANDIDATE">{copy.roleCandidate}</option>
                        <option value="RECRUITER">{copy.roleRecruiter}</option>
                        <option value="ADMIN">{copy.roleAdmin}</option>
                      </select>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={cn(
                          "text-[11.5px] font-[450] px-3 py-1 rounded-full border inline-block",
                          u.plan === "master"
                            ? "bg-[#F3E8FD] text-[#6E2594] border-[#E9D5FF]"
                            : u.plan === "pro"
                              ? "bg-[#E8F0FE] text-[#1A73E8] border-[#D2E3FC]"
                              : u.plan === "starter"
                                ? "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]"
                                : "bg-[#F8F9FA] text-[#45474D] border-[rgba(33,34,38,0.1)]",
                        )}
                      >
                        {planLabel(u.plan)}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono font-medium text-[#121317]">
                      {fillCopy(copy.sessions, { n: u.remainingSessions })}
                    </td>

                    <td className="py-4 px-4">
                      <span className="font-mono font-medium text-[#1A73E8] bg-[#E8F0FE] border border-[#D2E3FC] px-2.5 py-0.5 rounded-full text-[12px]">
                        {u.avgScore}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      {u.status === "active" ? (
                        <span className="bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] text-[11px] font-[450] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />
                          {copy.active}
                        </span>
                      ) : (
                        <span className="bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF] text-[11px] font-[450] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Lock size={11} />
                          {copy.locked}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleGrantSessions(u.id)}
                          className="bg-[#F8F9FA] hover:bg-[#121317] hover:text-white text-[#121317] border border-[rgba(33,34,38,0.12)] px-3 py-1 rounded-full text-[12px] font-[450] transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={12} weight="bold" />
                          <span>{copy.grant}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleUserStatus(u.id)}
                          className={cn(
                            "px-3 py-1 rounded-full text-[12px] font-[450] border transition-all cursor-pointer flex items-center gap-1",
                            u.status === "active"
                              ? "bg-white text-[#C5221F] border-[#FAD2CF] hover:bg-[#FCE8E6]"
                              : "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6] hover:bg-[#CEEAD6]",
                          )}
                        >
                          {u.status === "active" ? (
                            <>
                              <Lock size={12} /> {copy.lock}
                            </>
                          ) : (
                            <>
                              <LockOpen size={12} /> {copy.unlock}
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-[12.5px] text-[#45474D]">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-[rgba(33,34,38,0.12)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#F8F9FA]"
            >
              {copy.previous}
            </button>
            <span>{fillCopy(copy.pageOf, { page, pages: totalPages })}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-full border border-[rgba(33,34,38,0.12)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#F8F9FA]"
            >
              {copy.next}
            </button>
          </div>
        )}
      </div>
    </AdminAppShell>
  );
}
