"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Gauge,
  Users,
  BuildingOffice,
  ShieldCheck,
  CheckCircle,
  Receipt,
  SignOut,
  ChatCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/lib/i18n";

interface AdminAppShellProps {
  children: React.ReactNode;
}

export function AdminAppShell({ children }: AdminAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, displayName, initials, logout } = useUser();
  const { t } = useLocale();

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "ADMIN") router.replace("/unauthorized");
  }, [isLoading, user, router]);

  const isActive = (href: string) => pathname === href;

  const nav = [
    { href: "/admin", label: t("adminOverview"), short: t("adminShortOverview"), icon: Gauge },
    { href: "/admin/users", label: t("adminUsers"), short: t("adminShortUsers"), icon: Users },
    {
      href: "/admin/enterprises",
      label: t("adminEnterprises"),
      short: t("adminShortEnterprises"),
      icon: BuildingOffice,
    },
    {
      href: "/admin/interviews",
      label: t("adminInterviews"),
      short: t("adminShortInterviews"),
      icon: ShieldCheck,
    },
    {
      href: "/admin/billing",
      label: t("adminBilling"),
      short: t("adminShortBilling"),
      icon: Receipt,
    },
    {
      href: "/admin/support",
      label: t("adminSupport"),
      short: t("adminShortSupport"),
      icon: ChatCircle,
    },
  ];

  const titleFor = () => {
    if (pathname === "/admin") return t("adminOverview");
    if (pathname === "/admin/users") return t("adminUsers");
    if (pathname === "/admin/enterprises") return t("adminEnterprises");
    if (pathname === "/admin/interviews") return t("adminInterviews");
    if (pathname === "/admin/billing") return t("adminBilling");
    if (pathname === "/admin/support") return t("adminSupport");
    return t("adminTitle");
  };

  return (
    <div className="admin-shell text-[#121317] flex font-sans">
      <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 bg-white border-r border-[rgba(33,34,38,0.08)] sticky top-0 h-screen p-5 z-40 select-none">
        <div>
          <Link href="/admin" className="flex items-center gap-2.5 px-2 py-1.5 mb-8 group">
            <div className="w-7 h-7 flex items-center justify-center">
              <svg
                viewBox="0 0 28 28"
                width="24"
                height="24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 3L25 22H3L14 3Z"
                  stroke="#121317"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <circle cx="14" cy="16" r="3" fill="#4285F4" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans font-[450] text-[16.5px] tracking-tight text-[#121317]">
                PivotAssist
              </span>
            </div>
            <span className="ml-auto font-mono text-[10px] text-[#45474D] bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] px-2 py-0.5 rounded-full font-semibold">
              {t("adminShortOverview")}
            </span>
          </Link>

          <div className="px-3 mb-2 font-mono text-[10px] uppercase tracking-wider text-[#45474D]">
            {t("adminNavLabel")}
          </div>

          <nav className="space-y-1" aria-label={t("adminNavLabel")}>
            {nav.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13.5px] transition-all duration-150 cursor-pointer",
                    active
                      ? "bg-[#121317] text-white font-[450] shadow-xs"
                      : "text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04]",
                  )}
                >
                  <Icon
                    size={17}
                    weight={active ? "fill" : "regular"}
                    className={cn(active ? "text-white" : "text-[#45474D]")}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="console-sidebar-footer">
          <div className="console-sidebar-note">
            <div className="flex items-center gap-1.5 text-[11.5px] font-[450] text-[#137333]">
              <CheckCircle size={14} weight="fill" className="text-[#34A853]" />
              <span>{t("adminHealthy")}</span>
            </div>
          </div>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="console-main">
        <header className="console-topbar">
          <div className="console-topbar-title">
            <strong>{titleFor()}</strong>
            <span>{t("adminSuffix")}</span>
          </div>

          <div className="console-topbar-user">
            <LanguageToggle compact />
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] text-[11.5px] font-[450]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34A853] animate-pulse" />
              <span>{t("adminRole")}</span>
            </div>

            <span className="console-topbar-user-meta">
              {displayName || t("adminRole")}
              <small>{user?.email || t("entLoggedOut")}</small>
            </span>
            <span className="console-avatar">{user ? initials : "AD"}</span>

            <button
              type="button"
              onClick={logout}
              title={t("logout")}
              aria-label={t("logout")}
              className="console-topbar-action"
            >
              <SignOut size={18} />
            </button>
          </div>
        </header>

        <div className="console-content">{children}</div>
      </main>

      <nav className="console-mobile-nav" aria-label={t("adminNavLabel")}>
        {nav.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-1.5 px-2 rounded-2xl text-[10px] transition-colors min-w-0",
                active ? "text-[#121317] font-semibold" : "text-[#45474D]",
              )}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              <span className="truncate max-w-[64px]">{short}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
