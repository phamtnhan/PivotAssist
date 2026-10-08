import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { AppProviders } from "@/components/AppProviders";
import { SkipLink } from "@/components/SkipLink";
import { getSessionUser } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function localeFromCookie(value?: string): Locale {
  return value === "en" ? "en" : "vi";
}

export async function generateMetadata(): Promise<Metadata> {
  const jar = await cookies();
  const locale = localeFromCookie(jar.get("pivotassist-locale")?.value);
  const en = locale === "en";
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: en
        ? "PivotAssist — AI interview practice and hiring"
        : "PivotAssist — Luyện phỏng vấn AI và tuyển dụng",
      template: "%s · PivotAssist",
    },
    description: en
      ? "AI interview practice, job applications, and ranking per role — never one global scoreboard."
      : "Nền tảng luyện phỏng vấn AI, nộp hồ sơ và xếp hạng theo từng vị trí tuyển dụng.",
    alternates: { canonical: "/", languages: { vi: "/", en: "/" } },
    openGraph: {
      title: "PivotAssist",
      description: en
        ? "AI interview practice, jobs, and interview rooms in one product."
        : "Luyện phỏng vấn AI, việc làm và phòng phỏng vấn trong một sản phẩm.",
      url: siteUrl,
      siteName: "PivotAssist",
      locale: en ? "en_US" : "vi_VN",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const locale = localeFromCookie(jar.get("pivotassist-locale")?.value);
  const initialUser = await getSessionUser();
  return (
    <html lang={locale}>
      <body className="antialiased min-h-[100dvh] bg-paper text-graphite font-sans">
        <AppProviders initialLocale={locale} initialUser={initialUser}>
          <SkipLink />
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
