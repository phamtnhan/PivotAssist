"use client";

// REQ-0010 — Hỗ trợ stays on /enterprise/dashboard via openSupportChat
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SquaresFour,
  PlusCircle,
  ChartBar,
  Gear,
  CheckCircle,
  SignOut,
  VideoCamera,
  ChatCircle,
} from "@phosphor-icons/react";
import { useUser } from "@/lib/useUser";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { openSupportChat } from "@/lib/support-chat";
import { useLocale } from "@/lib/i18n";

interface EnterpriseAppShellProps {
  children: React.ReactNode;
}

export function EnterpriseAppShell({ children }: EnterpriseAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, displayName, initials, logout } = useUser();
  const { t } = useLocale();
  const isEnterprise = Boolean(user && ["RECRUITER", "ADMIN"].includes(user.role));
  const isActive = (href: string) =>
    pathname === href ||
    (href === "/enterprise/dashboard" &&
      (pathname.startsWith("/enterprise/candidates") ||
        (pathname.startsWith("/enterprise/jobs/") && pathname !== "/enterprise/jobs/create")));

  const nav = [
    {
      href: "/enterprise/dashboard",
      label: t("entNavPipeline"),
      short: t("entShortPipeline"),
      icon: SquaresFour,
    },
    {
      href: "/enterprise/jobs/create",
      label: t("entNavCreate"),
      short: t("entShortCreate"),
      icon: PlusCircle,
    },
    {
      href: "/enterprise/analytics",
      label: t("entNavAnalytics"),
      short: t("entShortAnalytics"),
      icon: ChartBar,
    },
    { href: "/face-to-face", label: t("entNavRoom"), short: t("entShortRoom"), icon: VideoCamera },
    {
      href: "/enterprise/settings",
      label: t("entNavCompany"),
      short: t("entShortCompany"),
      icon: Gear,
    },
  ];

  const titleFor = () => {
    if (pathname === "/enterprise/dashboard") return t("entNavPipeline");
    if (pathname.startsWith("/enterprise/candidates")) return t("entTitleCandidates");
    if (pathname.startsWith("/enterprise/jobs/") && pathname !== "/enterprise/jobs/create")
      return t("entTitleJob");
    if (pathname === "/enterprise/jobs/create") return t("entNavCreate");
    if (pathname === "/enterprise/analytics") return t("entNavAnalytics");
    if (pathname === "/enterprise/settings") return t("entNavCompany");
    if (pathname === "/face-to-face") return t("entNavRoom");
    return t("entTitleSpace");
  };

  const roleLabel = () => {
    if (user?.role === "ADMIN") return t("adminRole");
    if (user?.role === "RECRUITER") return t("entRecruiter");
    return t("entNoteNeed");
  };

  useEffect(() => {
    if (isLoading) return;
    if (!isEnterprise) router.replace("/unauthorized");
  }, [isLoading, isEnterprise, router]);

  return (
    <div className="enterprise-shell">
      <aside className="console-sidebar">
        <Link href="/enterprise/dashboard" className="console-brand">
          <span className="console-brand-mark" aria-hidden="true">
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
          </span>
          <span>
            <span className="console-brand-name">PivotAssist</span>
            <span className="console-brand-subtitle">{t("entSubtitle")}</span>
          </span>
        </Link>

        <span className="console-nav-label">{t("entNavLabel")}</span>
        <nav aria-label={t("entNavLabel")}>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}>
              <Icon size={18} weight={isActive(href) ? "fill" : "regular"} />
              <span>{label}</span>
            </Link>
          ))}
          <button type="button" onClick={() => openSupportChat()}>
            <ChatCircle size={18} />
            <span>{t("navSupport")}</span>
          </button>
        </nav>

        <div className="console-sidebar-footer">
          <div className="console-sidebar-note">
            <strong>
              <CheckCircle size={12} weight="fill" /> {t("entNoteTitle")}
            </strong>
            <span>{isEnterprise ? t("entNoteActive") : t("entNoteNeed")}</span>
          </div>
        </div>
      </aside>

      <nav className="console-mobile-nav" aria-label={t("entNavLabel")}>
        {nav.map(({ href, short, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}>
            <Icon size={17} weight={isActive(href) ? "fill" : "regular"} />
            <span>{short}</span>
          </Link>
        ))}
      </nav>

      <main id="main-content" tabIndex={-1} className="console-main">
        <header className="console-topbar">
          <div className="console-topbar-title">
            <strong>{titleFor()}</strong> <span>{t("entSuffix")}</span>
          </div>
          <div className="console-topbar-user">
            <LanguageToggle compact />
            <NotificationBell />
            <span className="console-topbar-user-meta">
              {isLoading ? t("entChecking") : roleLabel()}
              <small>{user ? displayName : t("entLoggedOut")}</small>
            </span>
            <span className="console-avatar">{user ? initials : "—"}</span>
            <button
              type="button"
              onClick={logout}
              className="console-topbar-action"
              aria-label={t("logout")}
              title={t("logout")}
            >
              <SignOut size={17} />
            </button>
          </div>
        </header>
        <div className="console-content">
          {isLoading ? (
            <p className="text-[13px] text-ink-soft">{t("entAuthing")}</p>
          ) : isEnterprise ? (
            children
          ) : (
            <p className="text-[13px] text-ink-soft">{t("entRedirect")}</p>
          )}
        </div>
      </main>
    </div>
  );
}
