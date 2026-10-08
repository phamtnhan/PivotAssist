"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { openSupportChat } from "@/lib/support-chat";
import { useLocale } from "@/lib/i18n";

export default function SupportRedirectPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { t } = useLocale();

  useEffect(() => {
    openSupportChat();
    if (isLoading) return;
    if (user?.role === "ADMIN") {
      router.replace("/admin/support");
      return;
    }
    if (user?.role === "RECRUITER") {
      router.replace("/enterprise/dashboard");
      return;
    }
    router.replace(user ? "/home" : "/login");
  }, [isLoading, router, user]);

  return <p className="p-8 text-[13px] text-[#45474D]">{t("supportOpening")}</p>;
}
