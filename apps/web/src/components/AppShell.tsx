"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isSessionRequiredPath } from "@/lib/session-paths";
import {
  House,
  Briefcase,
  VideoCamera,
  Microphone,
  FileText,
  BookOpenText,
  Gear,
  ArrowUpRight,
  SignOut,
  ChatCircle,
  MapTrifold,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { NotificationBell } from "@/components/NotificationBell";
import { EnterpriseAppShell } from "@/components/EnterpriseAppShell";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/lib/i18n";
import { openSupportChat } from "@/lib/support-chat";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, displayName, initials, logout, isLoading } = useUser();
  const { t, locale } = useLocale();

  useEffect(() => {
    if (isLoading || user) return;
    if (isSessionRequiredPath(pathname)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, pathname, router]);

  const navItems = [
    { href: "/home", label: t("navHome"), short: locale === "en" ? "Home" : "Chủ", icon: House },
    {
      href: "/interview",
      label: t("navInterview"),
      short: locale === "en" ? "Practice" : "Luyện",
      icon: Microphone,
    },
    {
      href: "/jobs",
      label: t("navJobs"),
      short: locale === "en" ? "Jobs" : "Việc",
      icon: Briefcase,
    },
    {
      href: "/applications",
      label: t("navApplications"),
      short: locale === "en" ? "Applied" : "Đã nộp",
      icon: FileText,
    },
    {
      href: "/profiles",
      label: t("navProfiles"),
      short: locale === "en" ? "Profile" : "Hồ sơ",
      icon: FileText,
    },
    {
      href: "/roadmap",
      label: locale === "en" ? "Career roadmap" : "Lộ trình nghề nghiệp",
      short: locale === "en" ? "Roadmap" : "Lộ trình",
      icon: MapTrifold,
    },
    {
      href: "/face-to-face",
      label: t("navFaceToFace"),
      short: locale === "en" ? "Room" : "Phòng",
      icon: VideoCamera,
    },
    {
      href: "/services",
      label: t("navServices"),
      short: locale === "en" ? "Plans" : "Gói",
      icon: BookOpenText,
    },
  ];

  const titleFor = (path: string) => {
    if (path === "/interview") return t("navInterview");
    if (path === "/interview/setup") return t("crumbSetup");
    if (path === "/interview/room") return t("roomBadge");
    if (path.startsWith("/interview/report")) return t("crumbReport");
    if (path === "/home" || path === "/dashboard") return t("navHome");
    if (path === "/jobs") return t("navJobs");
    if (path === "/applications") return t("navApplications");
    if (path === "/profiles") return t("navProfiles");
    if (path === "/roadmap") return locale === "en" ? "Career roadmap" : "Lộ trình nghề nghiệp";
    if (path === "/services") return t("navServices");
    if (path === "/settings") return t("settings");
    if (path === "/support") return t("navSupport");
    if (path === "/face-to-face") return t("navFaceToFace");
    if (path === "/legal") return t("legalTitle");
    return t("navHome");
  };

  const isCustomShellRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/unauthorized" ||
    pathname === "/support" ||
    pathname === "/enterprise" ||
    pathname.startsWith("/enterprise") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin") ||
    pathname === "/interview/room" ||
    (pathname.startsWith("/face-to-face/") && pathname !== "/face-to-face");

  const hasOwnMainLandmark =
    pathname === "/" ||
    pathname === "/interview/room" ||
    pathname.startsWith("/enterprise/") ||
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/face-to-face/") && pathname !== "/face-to-face");

  if (isCustomShellRoute) {
    if (hasOwnMainLandmark) return <>{children}</>;
    return (
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    );
  }

  if (user && ["RECRUITER", "ADMIN"].includes(user.role)) {
    return <EnterpriseAppShell>{children}</EnterpriseAppShell>;
  }

  const isActive = (href: string) =>
    pathname === href || (href === "/home" && pathname === "/dashboard");

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#121317] flex font-sans">
      <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 bg-white border-r border-[rgba(33,34,38,0.08)] sticky top-0 h-screen p-5 z-40 select-none">
        <div>
          <Link href="/home" className="flex items-center gap-2.5 px-2 py-1.5 mb-8 group min-w-0">
            <div className="w-7 h-7 flex items-center justify-center shrink-0">
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
            <span className="font-sans font-[450] text-[16.5px] tracking-normal text-[#121317] truncate">
              PivotAssist
            </span>
          </Link>

          <div className="px-3 mb-2 font-mono text-[10px] uppercase tracking-wider text-[#45474D]">
            {t("navLabel")}
          </div>

          <nav className="space-y-1" aria-label={t("navAria")}>
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13.5px] transition-all duration-150 cursor-pointer min-w-0",
                    active
                      ? "bg-[#121317] text-white font-[450] shadow-xs"
                      : "text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04] font-normal",
                  )}
                >
                  <Icon
                    size={18}
                    weight={active ? "fill" : "regular"}
                    className={cn("shrink-0", active ? "text-white" : "text-[#45474D]")}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 pt-4 border-t border-[rgba(33,34,38,0.06)]">
          <button
            type="button"
            onClick={() => openSupportChat()}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-full text-[12.5px] font-[450] text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04] transition-colors"
          >
            <span>{t("navSupport")}</span>
            <ChatCircle size={14} />
          </button>
          <Link
            href="/enterprise"
            className="flex items-center justify-between px-3.5 py-2 rounded-full text-[12.5px] font-[450] text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04] transition-colors"
          >
            <span>{t("navEnterprise")}</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 sm:h-16 px-3 sm:px-6 lg:px-8 border-b border-[rgba(33,34,38,0.08)] bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2 text-[13px] font-sans min-w-0">
            <span className="font-mono text-[#45474D] text-[12px] hidden sm:inline">
              {t("workspace")}
            </span>
            <span className="text-[#45474D] font-mono hidden sm:inline">/</span>
            <strong className="text-[#121317] font-[450] tracking-normal truncate">
              {titleFor(pathname)}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LanguageToggle compact />
            <NotificationBell />
            <Link
              href="/settings"
              aria-label={t("settings")}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04] transition-colors"
            >
              <Gear size={18} />
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border border-[rgba(33,34,38,0.08)] bg-white hover:border-[rgba(33,34,38,0.16)] transition-all cursor-pointer shadow-2xs max-w-[160px]"
            >
              <div className="w-6 h-6 rounded-full bg-[#121317] text-white font-[450] text-[10.5px] flex items-center justify-center shrink-0">
                {initials}
              </div>
              <span className="font-sans font-[450] text-[12.5px] text-[#121317] hidden lg:inline truncate">
                {displayName}
              </span>
            </Link>
            <button
              type="button"
              onClick={logout}
              title={t("logout")}
              aria-label={t("logout")}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#45474D] hover:text-[#EA4335] hover:bg-[#FCE8E6] transition-colors cursor-pointer"
            >
              <SignOut size={18} />
            </button>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 pb-24 md:pb-8"
        >
          {children}
        </main>
      </div>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[rgba(33,34,38,0.08)] shadow-lg"
        aria-label={t("navMobile")}
      >
        <div className="flex items-stretch w-full overflow-x-auto no-scrollbar">
          {navItems
            .filter((item) =>
              ["/home", "/interview", "/jobs", "/applications", "/face-to-face"].includes(
                item.href,
              ),
            )
            .map(({ href, short, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-[3.4rem] text-[10px] leading-tight",
                    active ? "text-[#121317] font-[450]" : "text-[#45474D]",
                  )}
                >
                  <Icon size={18} weight={active ? "fill" : "regular"} />
                  <span className="whitespace-nowrap">{short}</span>
                </Link>
              );
            })}
        </div>
      </nav>
    </div>
  );
}
