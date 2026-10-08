"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CameraAlignmentGuide = dynamic(
  () => import("@/components/CameraAlignmentGuide").then((mod) => mod.CameraAlignmentGuide),
  { ssr: false },
);
import {
  ShieldCheck,
  ArrowRight,
  Microphone,
  Sparkle,
  Sliders,
  ArrowLeft,
  FileText,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { isDemoApplicationId } from "@/lib/application-store";
import { MediaConsentDialog, hasMediaConsent } from "@/components/MediaConsentDialog";
import { readPromptList, stashInterviewPrompts } from "@/lib/interview-session-cache";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";

export default function InterviewSetupPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [role, setRole] = useState("");
  const [questionCount, setQuestionCount] = useState<number>(8);
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const [useMasterCv, setUseMasterCv] = useState(true);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [applicationJobId, setApplicationJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [cvContext, setCvContext] = useState<{
    filename: string;
    skills: string[];
    summary: string;
    fullName: string | null;
  } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingApplicationId = params.get("applicationId");
    const incomingJobId = params.get("jobId");
    const incomingRole = params.get("role");
    const incomingMode = params.get("mode");
    const storedRole = window.sessionStorage.getItem("pivotassist:practiceRole");

    if (incomingApplicationId && !isDemoApplicationId(incomingApplicationId)) {
      setApplicationId(incomingApplicationId);
    }
    if (incomingJobId) setApplicationJobId(incomingJobId);
    if (incomingRole) setRole(incomingRole);
    else if (storedRole) {
      setRole(storedRole);
      window.sessionStorage.removeItem("pivotassist:practiceRole");
    }
    if (incomingMode === "speed") setQuestionCount(3);
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        const fromCv =
          payload?.user?.profile?.currentJobTitle || payload?.user?.profile?.targetJobTitle;
        if (response.ok && payload?.success && !incomingRole && !storedRole && fromCv) {
          setRole(fromCv);
        }
      })
      .catch(() => null);
    fetch("/api/resumes", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        const active =
          (payload?.resumes ?? []).find((item: { isActive?: boolean }) => item.isActive) ??
          payload?.resumes?.[0];
        if (response.ok && active) {
          const parsedTitle =
            typeof active.parsed?.currentJobTitle === "string" ? active.parsed.currentJobTitle : "";
          setCvContext({
            filename: active.filename ?? t("setupCvFile"),
            skills: Array.isArray(active.parsed?.extractedSkills)
              ? active.parsed.extractedSkills
              : [],
            summary:
              typeof active.parsed?.summary === "string"
                ? active.parsed.summary
                : (active.parsedText ?? "").slice(0, 280),
            fullName: active.parsed?.fullName ?? null,
          });
          if (!incomingRole && !storedRole && parsedTitle) setRole(parsedTitle);
        }
      })
      .catch(() => null);
  }, [t]);

  const handleStartInterview = async () => {
    setStartError(null);
    if (!hasMediaConsent("mic")) {
      setConsentOpen(true);
      return;
    }
    setIsStarting(true);

    let sessionId: string | null = null;
    if (applicationId && !isDemoApplicationId(applicationId)) {
      try {
        const response = await fetch(
          `/api/applications/${encodeURIComponent(applicationId)}/interview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetRole: role,
              questionCount,
              language,
            }),
          },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(apiErrorText(payload, locale, t("setupStartFailApp")));
        }
        sessionId = payload.session?.id ?? null;
        const unique = readPromptList(payload);
        if (sessionId) stashInterviewPrompts(sessionId, unique, language);
      } catch (error) {
        setStartError(error instanceof Error ? error.message : t("setupStartFailApp"));
        setIsStarting(false);
        return;
      }
    } else if (!applicationId) {
      try {
        const response = await fetch("/api/interviews/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetRole: role,
            customJd: "",
            questionCount,
            language,
            useMasterCv,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(apiErrorText(payload, locale, t("setupStartFail")));
        sessionId = payload.session?.id ?? null;
        const unique = readPromptList(payload);
        if (sessionId) stashInterviewPrompts(sessionId, unique, language);
      } catch (error) {
        setStartError(error instanceof Error ? error.message : t("setupStartFail"));
        setIsStarting(false);
        return;
      }
    }

    const query = new URLSearchParams({ role });
    if (applicationId) query.set("applicationId", applicationId);
    if (applicationJobId) query.set("jobId", applicationJobId);
    if (sessionId) query.set("sessionId", sessionId);
    query.set("lang", language);
    router.push(`/interview/room?${query.toString()}`);
  };

  return (
    <div className="max-w-[1180px] mx-auto animate-in fade-in duration-300 font-sans pb-24">
      {/* Header */}
      <div className="border-b border-[rgba(33,34,38,0.06)] pb-6 mb-8">
        <Link
          href="/interview"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-[450] text-[#45474D] hover:text-[#121317] mb-3 transition-colors"
        >
          <ArrowLeft size={14} weight="bold" /> {t("setupBack")}
        </Link>

        <div className="flex items-center gap-2 text-[11.5px] font-[450] text-[#1A73E8] uppercase tracking-wider mb-1">
          <Sparkle size={14} weight="fill" />
          <span>{t("setupEyebrow")}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-sans font-[450] text-[#121317] tracking-[-0.02em]">
          {t("setupTitle")}
        </h1>
        <p className="text-[14px] text-[#45474D] mt-1 font-normal">{t("setupLead")}</p>
      </div>

      {applicationId && (
        <div
          className="mb-6 flex items-start gap-3 rounded-2xl border border-[#D2E3FC] bg-[#F8FBFF] px-4 py-3.5 text-[12.5px] text-[#45474D]"
          role="status"
        >
          <FileText size={18} className="mt-0.5 shrink-0 text-[#1A73E8]" />
          <div>
            <div className="font-[450] text-[#121317]">{t("setupAppBanner")}</div>
            <p className="mt-1 leading-relaxed">{t("setupAppLead")}</p>
          </div>
        </div>
      )}

      {startError && (
        <div
          className="mb-6 flex items-start gap-2 rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[12.5px] text-[#C5221F]"
          role="alert"
        >
          <WarningCircle size={17} weight="fill" className="mt-0.5 shrink-0" />
          <span>{startError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Configuration Form (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 sm:p-7 shadow-2xs space-y-5">
            <h3 className="text-[15px] font-[450] text-[#121317] border-b border-[rgba(33,34,38,0.06)] pb-3 flex items-center gap-2">
              <Sliders size={18} className="text-[#1A73E8]" />
              {t("setupConfig")}
            </h3>

            {/* Target Role Selector */}
            <div>
              <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                {t("setupRole")}
              </label>
              <input
                list="pivotassist-roles"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={t("setupRolePh")}
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-3.5 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all font-normal"
              />
              <datalist id="pivotassist-roles">
                {(locale === "en"
                  ? [
                      "Frontend engineer",
                      "Backend engineer",
                      "Product specialist",
                      "Sales executive",
                      "Quality specialist",
                    ]
                  : [
                      "Kỹ sư giao diện",
                      "Kỹ sư máy chủ",
                      "Chuyên viên sản phẩm",
                      "Chuyên viên kinh doanh",
                      "Chuyên viên kiểm thử",
                    ]
                ).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            {/* Dùng CV đã tải */}
            <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] flex items-center justify-between gap-4">
              <div>
                <div className="font-[450] text-[13.5px] text-[#121317]">{t("setupUseCv")}</div>
                <div className="text-[12px] text-[#45474D] font-normal">
                  {cvContext
                    ? `${cvContext.filename}${cvContext.fullName ? ` · ${cvContext.fullName}` : ""} · ${cvContext.skills.slice(0, 4).join(", ") || t("setupCvRead")}`
                    : t("setupUseCvHint")}
                </div>
                {useMasterCv && cvContext?.summary ? (
                  <p className="text-[11.5px] text-[#45474D] mt-1.5 leading-relaxed">
                    {cvContext.summary.slice(0, 220)}
                  </p>
                ) : null}
              </div>
              <input
                type="checkbox"
                checked={useMasterCv}
                onChange={() => setUseMasterCv(!useMasterCv)}
                className="w-4 h-4 accent-[#121317] rounded cursor-pointer"
              />
            </div>

            {!applicationId ? (
              <div className="rounded-2xl border border-[#D2E3FC] bg-[#F8FBFF] px-4 py-3 text-[12.5px] text-[#45474D]">
                {t("setupUseCvHint")}
              </div>
            ) : null}

            {/* Questions count & Language */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {t("setupQCount")}
                </label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-3 py-2 text-[13px] text-[#121317] focus:outline-none cursor-pointer font-normal"
                >
                  <option value={3}>{t("setupQ3")}</option>
                  <option value={5}>{t("setupQ5")}</option>
                  <option value={8}>{t("setupQ8")}</option>
                  <option value={12}>{t("setupQ12")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {t("setupLang")}
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-3 py-2 text-[13px] text-[#121317] focus:outline-none cursor-pointer font-normal"
                >
                  <option value="vi">{t("setupLangVi")}</option>
                  <option value="en">{t("setupLangEn")}</option>
                </select>
              </div>
            </div>

            {/* Privacy Shield */}
            <div className="p-3 rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] text-[12px] text-[#0D652D] flex items-center gap-2">
              <ShieldCheck size={18} weight="fill" className="text-[#137333] shrink-0" />
              <span className="font-normal">{t("setupPrivacy")}</span>
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={handleStartInterview}
              disabled={isStarting}
              className="w-full bg-[#121317] hover:bg-[#2D3139] active:scale-[0.99] text-white py-3.5 px-6 rounded-full font-[450] text-[14px] flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {isStarting ? <SpinnerGap size={17} className="animate-spin" /> : null}
              <span>
                {isStarting
                  ? t("setupStarting")
                  : applicationId
                    ? t("setupEnter")
                    : t("setupEnter")}
              </span>
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </div>

        {/* Kiểm tra micro và loa */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 sm:p-7 shadow-2xs space-y-4">
            <h3 className="text-[15px] font-[450] text-[#121317] border-b border-[rgba(33,34,38,0.06)] pb-3 flex items-center gap-2">
              <Microphone size={18} className="text-[#1A73E8]" />
              {t("setupMicTitle")}
            </h3>
            <p className="text-[12.5px] text-[#45474D] leading-relaxed">{t("setupMicLead")}</p>

            <CameraAlignmentGuide
              mode="mic"
              onMicDeviceChange={(deviceId) => {
                if (deviceId) window.sessionStorage.setItem("pivotassist:selectedMic", deviceId);
              }}
            />
          </div>
        </div>
      </div>

      <MediaConsentDialog
        kind="mic"
        open={consentOpen}
        onCancel={() => setConsentOpen(false)}
        onAccept={() => {
          setConsentOpen(false);
          void handleStartInterview();
        }}
      />
    </div>
  );
}
