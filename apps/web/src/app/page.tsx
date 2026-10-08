"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { openSupportChat } from "@/lib/support-chat";
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  Sparkle,
  FileText,
  Brain,
  VideoCamera,
  Target,
  ChartLineUp,
  ShieldCheck,
  Lightning,
  Eye,
  Microphone,
  Buildings,
  Cpu,
  LockKey,
  DownloadSimple,
} from "@phosphor-icons/react";
import { LoginModal } from "@/components/LoginModal";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { BorderGlow } from "@/components/react-bits/BorderGlow";
import { GradientText } from "@/components/react-bits/GradientText";

const Waves = dynamic(() => import("@/components/react-bits/Waves").then((mod) => mod.Waves), {
  ssr: false,
});
const HeroMotionScene = dynamic(
  () => import("@/components/HeroMotionScene").then((mod) => mod.HeroMotionScene),
  { ssr: false },
);
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/lib/i18n";
import { landingCopy } from "@/lib/i18n-landing";

export default function LandingPage() {
  const { locale } = useLocale();
  const copy = landingCopy[locale];
  const demoRoles = useMemo(
    () => [
      {
        id: "fe",
        label: copy.demoFeLabel,
        role: copy.demoFeRole,
        company: copy.demoFeCo,
        question: copy.demoFeQ,
      },
      {
        id: "da",
        label: copy.demoDaLabel,
        role: copy.demoDaRole,
        company: copy.demoDaCo,
        question: copy.demoDaQ,
      },
      {
        id: "mk",
        label: copy.demoMkLabel,
        role: copy.demoMkRole,
        company: copy.demoMkCo,
        question: copy.demoMkQ,
      },
    ],
    [copy],
  );
  const [persona, setPersona] = useState<"individual" | "business">("individual");
  const [activeDemoId, setActiveDemoId] = useState("fe");
  const activeDemo = demoRoles.find((role) => role.id === activeDemoId) ?? demoRoles[0];
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-[#121317] flex flex-col font-sans selection:bg-[#4285F4]/15 antialiased">
      {/* =========================================================================
          1. GOOGLE ANTIGRAVITY STYLE NAVIGATION BAR
          ========================================================================= */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-[rgba(33,34,38,0.06)] px-4 sm:px-6 lg:px-12 py-3.5 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* Antigravity Iconic Geometric Symbol */}
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
          <span className="font-sans font-[450] text-[16px] sm:text-[18px] tracking-tight text-[#121317] max-[360px]:sr-only">
            PivotAssist
          </span>
          <span className="hidden sm:inline-block font-sans text-[11px] text-[#45474D] px-2 py-0.5 rounded-full bg-[rgba(183,191,217,0.12)]">
            {copy.badge}
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1 text-[14px] font-[450] text-[#45474D]">
          <a
            href="#tinh-nang"
            className="hover:text-[#121317] hover:bg-black/[0.04] px-4 py-2 rounded-full transition-colors"
          >
            {copy.navFeatures}
          </a>
          <a
            href="#so-sanh"
            className="hover:text-[#121317] hover:bg-black/[0.04] px-4 py-2 rounded-full transition-colors"
          >
            {copy.navCompare}
          </a>
          <a
            href="#doanh-nghiep"
            className="hover:text-[#121317] hover:bg-black/[0.04] px-4 py-2 rounded-full transition-colors"
          >
            {copy.navBiz}
          </a>
          <a
            href="#bao-mat"
            className="hover:text-[#121317] hover:bg-black/[0.04] px-4 py-2 rounded-full transition-colors"
          >
            {copy.navLegal}
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <LanguageToggle compact />
          {/* Persona Capsule Switcher */}
          <div className="hidden sm:flex bg-[rgba(183,191,217,0.12)] rounded-full p-1">
            <button
              onClick={() => setPersona("individual")}
              className={cn(
                "px-3.5 py-1.5 font-sans text-xs tracking-tight rounded-full transition-all duration-200 cursor-pointer",
                persona === "individual"
                  ? "bg-white text-[#121317] font-[450] shadow-xs"
                  : "text-[#45474D] hover:text-[#121317]",
              )}
            >
              {copy.personaUser}
            </button>
            <button
              onClick={() => setPersona("business")}
              className={cn(
                "px-3.5 py-1.5 font-sans text-xs tracking-tight rounded-full transition-all duration-200 cursor-pointer",
                persona === "business"
                  ? "bg-white text-[#121317] font-[450] shadow-xs"
                  : "text-[#45474D] hover:text-[#121317]",
              )}
            >
              {copy.personaBiz}
            </button>
          </div>

          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="hidden sm:block text-[#45474D] text-[13.5px] hover:text-[#121317] font-[450] px-3 py-1.5 rounded-full hover:bg-black/[0.04] transition-colors cursor-pointer"
          >
            {copy.signIn}
          </button>

          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 sm:gap-2 bg-[#121317] hover:bg-[#2D3139] text-white font-[450] text-[12.5px] sm:text-[13.5px] px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            {persona === "individual" ? copy.ctaUser : copy.ctaBiz}
            <ArrowRight size={13} weight="bold" />
          </button>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1}>
        {/* =========================================================================
          2. HERO SECTION (Google Antigravity Floating Particles & Pure Typography)
          ========================================================================= */}
        <section className="relative isolate overflow-hidden pt-20 pb-16 px-6 lg:px-12 flex flex-col items-center text-center">
          {/* Generative Interactive Wave Field from react-bits */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-85 -z-10">
            <Waves
              lineColor="rgba(66, 133, 244, 0.2)"
              backgroundColor="transparent"
              waveSpeedX={0.015}
              waveSpeedY={0.008}
              waveAmpX={42}
              waveAmpY={26}
              xGap={14}
              yGap={28}
              friction={0.93}
              tension={0.006}
              maxCursorMove={120}
            />
          </div>

          {/* Center Brand Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 font-sans text-[13px] text-[#121317] bg-[rgba(183,191,217,0.12)] px-4 py-1.5 rounded-full mb-8 font-[450] tracking-tight">
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 2L18 16H2L10 2Z"
                stroke="#4285F4"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="11.5" r="2" fill="#EA4335" />
            </svg>
            <span>{copy.eyebrow}</span>
          </div>

          {/* Grand Headline: Exactly Google Antigravity Scale (76px-80px, font 450) with GradientText */}
          <h1 className="font-sans font-[450] text-5xl sm:text-6xl lg:text-[76px] tracking-[-0.03em] leading-[1.06] text-[#121317] max-w-5xl mx-auto">
            {persona === "individual" ? (
              <>
                {copy.h1User}
                <span className="block mt-2">
                  <GradientText
                    colors={["#121317", "#1A73E8", "#4285F4", "#121317"]}
                    animationSpeed={8}
                    showBorder={false}
                    className="font-[450] tracking-[-0.03em]"
                  >
                    {copy.h1UserAccent}
                  </GradientText>
                </span>
              </>
            ) : (
              <>
                {copy.h1Biz}
                <span className="block mt-2">
                  <GradientText
                    colors={["#121317", "#1A73E8", "#4285F4", "#121317"]}
                    animationSpeed={8}
                    showBorder={false}
                    className="font-[450] tracking-[-0.03em]"
                  >
                    {copy.h1BizAccent}
                  </GradientText>
                </span>
              </>
            )}
          </h1>

          {/* Clean Subtext (18px, font 400, Google Dark Grey) */}
          <p className="mt-6 text-[17px] sm:text-[19px] leading-relaxed text-[#45474D] max-w-2xl mx-auto font-normal">
            {persona === "individual" ? copy.leadUser : copy.leadBiz}
          </p>

          {/* Google Antigravity Pill Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8 mb-16">
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-[#121317] hover:bg-[#2D3139] text-white font-[450] text-[15px] px-7 py-3.5 rounded-full shadow-xs active:scale-[0.98] transition-all inline-flex items-center gap-2.5 cursor-pointer"
            >
              {persona === "individual" ? copy.startFree : copy.startBiz}
              <ArrowRight size={15} weight="bold" />
            </button>

            <a
              href="#tinh-nang"
              className="bg-[rgba(183,191,217,0.14)] hover:bg-[rgba(183,191,217,0.24)] text-[#121317] font-[450] text-[15px] px-6 py-3.5 rounded-full transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              {copy.explore}
            </a>
          </div>

          {/* Hero Interactive Studio Container: Centered, Clean Surface */}
          <div className="w-full max-w-5xl mx-auto mt-4 text-left">
            <HeroMotionScene
              roles={demoRoles}
              activeDemo={activeDemo}
              onSelectRole={(role) => setActiveDemoId(role.id)}
              onStart={() => setIsLoginModalOpen(true)}
            />
          </div>
        </section>

        {/* =========================================================================
          3. NUMERICAL BENCHMARK STRIP (Antigravity Minimalist Stats)
          ========================================================================= */}
        <section className="border-t border-b border-[rgba(33,34,38,0.06)] bg-[#F8F9FA] px-6 py-12 lg:px-12">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="font-sans font-[450] text-lg sm:text-xl text-[#121317] tracking-tight">
                {copy.statSessionsVal}
              </div>
              <div className="text-[13px] text-[#45474D] mt-1.5 font-normal">
                {copy.statSessions}
              </div>
            </div>
            <div>
              <div className="font-sans font-[450] text-lg sm:text-xl text-[#121317] tracking-tight">
                {copy.statHappyVal}
              </div>
              <div className="text-[13px] text-[#45474D] mt-1.5 font-normal">{copy.statHappy}</div>
            </div>
            <div>
              <div className="font-sans font-[450] text-lg sm:text-xl text-[#121317] tracking-tight">
                {copy.statAccuracyVal}
              </div>
              <div className="text-[13px] text-[#45474D] mt-1.5 font-normal">
                {copy.statAccuracy}
              </div>
            </div>
            <div>
              <div className="font-sans font-[450] text-lg sm:text-xl text-[#121317] tracking-tight">
                {copy.statCompaniesVal}
              </div>
              <div className="text-[13px] text-[#45474D] mt-1.5 font-normal">
                {copy.statCompanies}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
          4. PLATFORM ARCHITECTURE (Antigravity Clean Bento #lo-trinh)
          ========================================================================= */}
        <section className="px-6 py-24 lg:px-12 bg-white" id="tinh-nang">
          <div className="max-w-5xl mx-auto">
            <div className="max-w-2xl mb-16">
              <div className="font-sans text-[12.5px] font-[450] text-[#45474D] tracking-tight mb-3">
                {copy.archEyebrow}
              </div>
              <h2 className="font-sans font-[450] text-3xl sm:text-4xl lg:text-[42px] tracking-[-0.02em] text-[#121317] leading-tight">
                {copy.archTitle}
              </h2>
              <p className="text-[16px] text-[#45474D] mt-4 leading-relaxed">{copy.archLead}</p>
            </div>

            {/* Antigravity Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Module 1: CV parser */}
              <SpotlightCard
                className="rounded-[28px] border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] p-8 flex flex-col justify-between"
                spotlightColor="rgba(66, 133, 244, 0.08)"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-sans text-[11px] font-[450] tracking-tight text-[#121317] bg-white px-3 py-1 rounded-full border border-[rgba(33,34,38,0.08)]">
                      01
                    </span>
                    <FileText size={22} weight="regular" className="text-[#121317]" />
                  </div>
                  <h3 className="font-sans font-[450] text-[20px] text-[#121317] mb-2 tracking-tight">
                    {copy.m1}
                  </h3>
                  <p className="text-[14px] text-[#45474D] leading-relaxed mb-6 font-normal">
                    {copy.m1Body}
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-[rgba(33,34,38,0.06)] space-y-3">
                  <div>
                    <div className="flex justify-between items-center text-[12px] mb-1.5">
                      <span className="font-sans text-[#121317] font-medium">{copy.m1Meta}</span>
                      <span className="font-mono text-[11px] text-[#121317]">PDF+</span>
                    </div>
                    <p className="text-[11.5px] text-[#45474D] mt-2 font-normal leading-normal">
                      {copy.m1Note}
                    </p>
                  </div>
                </div>
              </SpotlightCard>

              {/* Module 2: Contextual JD Scenario Engine */}
              <SpotlightCard
                className="rounded-[28px] border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] p-8 flex flex-col justify-between"
                spotlightColor="rgba(66, 133, 244, 0.08)"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-sans text-[11px] font-[450] tracking-tight text-[#121317] bg-white px-3 py-1 rounded-full border border-[rgba(33,34,38,0.08)]">
                      02
                    </span>
                    <Brain size={22} weight="regular" className="text-[#121317]" />
                  </div>
                  <h3 className="font-sans font-[450] text-[20px] text-[#121317] mb-2 tracking-tight">
                    {copy.m2}
                  </h3>
                  <p className="text-[14px] text-[#45474D] leading-relaxed mb-6 font-normal">
                    {copy.m2Body}
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-[rgba(33,34,38,0.06)]">
                  <div className="text-[11px] font-sans text-[#4285F4] font-medium mb-1.5 flex items-center gap-1.5">
                    <Lightning size={13} weight="fill" />
                    {copy.m2Meta}
                  </div>
                  <p className="text-[12.5px] text-[#121317] leading-relaxed">{copy.m2Sample}</p>
                </div>
              </SpotlightCard>

              {/* Module 3: Speech & Biometric Telemetry */}
              <SpotlightCard
                className="rounded-[28px] border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] p-8 flex flex-col justify-between md:col-span-2 lg:col-span-1"
                spotlightColor="rgba(66, 133, 244, 0.08)"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-sans text-[11px] font-[450] tracking-tight text-[#121317] bg-white px-3 py-1 rounded-full border border-[rgba(33,34,38,0.08)]">
                      03
                    </span>
                    <Eye size={22} weight="regular" className="text-[#121317]" />
                  </div>
                  <h3 className="font-sans font-[450] text-[20px] text-[#121317] mb-2 tracking-tight">
                    {copy.m3}
                  </h3>
                  <p className="text-[14px] text-[#45474D] leading-relaxed mb-6 font-normal">
                    {copy.m3Body}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-white rounded-2xl p-4 border border-[rgba(33,34,38,0.06)]">
                  <div>
                    <div className="text-[11px] text-[#45474D]">{copy.m3Ai}</div>
                    <div className="text-[16px] font-[450] text-[#121317] mt-0.5">
                      {copy.m3AiVal}
                    </div>
                  </div>
                  <div className="border-l border-[rgba(33,34,38,0.08)] pl-3">
                    <div className="text-[11px] text-[#45474D]">{copy.m3Room}</div>
                    <div className="text-[16px] font-[450] text-[#121317] mt-0.5">
                      {copy.m3RoomVal}
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </div>

            {/* Module 4: Autonomous Talent Dispatch Banner */}
            <BorderGlow
              className="mt-6 rounded-[28px] p-8"
              glowColor="66 133 244"
              backgroundColor="#F8F9FA"
              borderRadius={28}
              glowRadius={30}
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 font-sans text-[11px] font-[450] text-[#121317] mb-2 bg-white px-3 py-1 rounded-full border border-[rgba(33,34,38,0.08)]">
                    {copy.m4Badge}
                  </div>
                  <h3 className="font-sans font-[450] text-2xl text-[#121317] tracking-tight">
                    {copy.m4Title}
                  </h3>
                  <p className="text-[14.5px] text-[#45474D] leading-relaxed mt-2 font-normal">
                    {copy.m4Body}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-[#121317] font-sans text-xs font-[450] border border-[rgba(33,34,38,0.08)]">
                    <CheckCircle size={15} weight="fill" className="text-[#34A853]" />
                    {copy.m4Ready}
                  </div>
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="bg-[#121317] hover:bg-[#2D3139] text-white text-[13.5px] font-[450] px-5 py-2.5 rounded-full transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    {copy.m4Cta} <ArrowRight size={13} weight="bold" />
                  </button>
                </div>
              </div>
            </BorderGlow>
          </div>
        </section>

        {/* =========================================================================
          5. COMMERCIAL VALUE MATRIX (Antigravity High-Integrity Cards)
          ========================================================================= */}
        <section
          className="px-6 py-24 lg:px-12 bg-[#F8F9FA] border-t border-b border-[rgba(33,34,38,0.06)]"
          id="so-sanh"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="font-sans text-[12.5px] font-[450] text-[#45474D] tracking-tight mb-3">
                {copy.valueEyebrow}
              </div>
              <h2 className="font-sans font-[450] text-3xl sm:text-4xl lg:text-[42px] tracking-[-0.02em] text-[#121317]">
                {copy.valueTitle}
              </h2>
              <p className="text-[16px] text-[#45474D] mt-4 leading-relaxed">{copy.valueLead}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {/* Standard Recruitment */}
              <div className="rounded-[28px] border border-[rgba(33,34,38,0.08)] bg-white p-8 sm:p-10 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between pb-6 border-b border-[rgba(33,34,38,0.06)] mb-6">
                    <div>
                      <span className="font-sans text-[11px] font-[450] text-[#45474D]">
                        {copy.oldLabel}
                      </span>
                      <h3 className="font-sans font-[450] text-xl text-[#121317] mt-1 tracking-tight">
                        {copy.oldTitle}
                      </h3>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-[#F1F3F4] flex items-center justify-center text-[#45474D]">
                      <XCircle size={20} />
                    </div>
                  </div>

                  <ul className="space-y-4 text-[14.5px] text-[#45474D]">
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                      <span>{copy.old1}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                      <span>{copy.old2}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                      <span>{copy.old3}</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-[rgba(33,34,38,0.06)] flex items-center justify-between text-[13px] text-[#45474D]">
                  <span>{copy.oldWaste}</span>
                  <span>{copy.oldConsist}</span>
                </div>
              </div>

              {/* PivotAssist Platform */}
              <div className="rounded-[28px] border border-[rgba(33,34,38,0.12)] bg-white p-8 sm:p-10 shadow-sm relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-6 border-b border-[rgba(33,34,38,0.06)] mb-6">
                    <div>
                      <span className="font-sans text-[11px] font-[450] text-[#4285F4]">
                        {copy.newLabel}
                      </span>
                      <h3 className="font-sans font-[450] text-xl text-[#121317] mt-1 tracking-tight">
                        {copy.newTitle}
                      </h3>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center">
                      <CheckCircle size={20} weight="fill" />
                    </div>
                  </div>

                  <ul className="space-y-4 text-[14.5px] text-[#121317]">
                    <li className="flex items-start gap-3">
                      <CheckCircle
                        size={18}
                        weight="fill"
                        className="text-[#34A853] shrink-0 mt-0.5"
                      />
                      <span>{copy.new1}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle
                        size={18}
                        weight="fill"
                        className="text-[#34A853] shrink-0 mt-0.5"
                      />
                      <span>{copy.new2}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle
                        size={18}
                        weight="fill"
                        className="text-[#34A853] shrink-0 mt-0.5"
                      />
                      <span>{copy.new3}</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-[rgba(33,34,38,0.06)] flex items-center justify-between text-[13px] text-[#121317] font-medium bg-[#F8F9FA] px-4 py-2.5 rounded-2xl">
                  <span>{copy.newSave}</span>
                  <span>{copy.newFit}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
          6. SECURITY & COMPLIANCE
          ========================================================================= */}
        <section className="px-6 py-20 lg:px-12 bg-white" id="bao-mat">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 bg-[#F8F9FA] rounded-[28px] p-8 sm:p-10 border border-[rgba(33,34,38,0.08)]">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-full bg-white border border-[rgba(33,34,38,0.08)] flex items-center justify-center text-[#121317] shrink-0">
                <LockKey size={24} weight="regular" />
              </div>
              <div>
                <h3 className="font-sans font-[450] text-xl text-[#121317] tracking-tight">
                  {copy.secTitle}
                </h3>
                <p className="text-[14px] text-[#45474D] mt-1 leading-relaxed max-w-xl">
                  {copy.secLead}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <span className="font-sans text-xs px-3.5 py-1.5 rounded-full bg-white border border-[rgba(33,34,38,0.08)] text-[#121317] font-[450]">
                {copy.secChip1}
              </span>
              <span className="font-sans text-xs px-3.5 py-1.5 rounded-full bg-white border border-[rgba(33,34,38,0.08)] text-[#121317] font-[450]">
                {copy.secChip2}
              </span>
              <span className="font-sans text-xs px-3.5 py-1.5 rounded-full bg-white border border-[rgba(33,34,38,0.08)] text-[#121317] font-[450]">
                {copy.secChip3}
              </span>
            </div>
          </div>
        </section>

        {/* =========================================================================
          7. GOOGLE ANTIGRAVITY DARK GETTING STARTED BANNER
          ========================================================================= */}
        <section className="px-6 py-12 lg:px-12 bg-white">
          <div className="max-w-5xl mx-auto rounded-[32px] bg-[#121317] text-white p-8 sm:p-12 md:p-14 text-center relative overflow-hidden shadow-[0_20px_50px_rgba(18,19,23,0.15)]">
            {/* Subtle Generative Wave Field (Inverted for Dark Background) */}
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-20">
              <Waves
                lineColor="rgba(255, 255, 255, 0.25)"
                backgroundColor="transparent"
                waveSpeedX={0.012}
                waveSpeedY={0.008}
                waveAmpX={32}
                waveAmpY={16}
                friction={0.92}
                tension={0.01}
                maxCursorMove={80}
                xGap={14}
                yGap={34}
              />
            </div>

            {/* Radial Ambient Glow */}
            <div
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[320px] bg-[radial-gradient(ellipse_at_center,rgba(66,133,244,0.18),transparent_70%)] pointer-events-none"
            />

            <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 font-sans text-[12px] font-[450] text-white/80 mb-4 bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-xs border border-white/10">
                <Sparkle size={13} weight="fill" className="text-[#4285F4]" />
                {copy.readyEyebrow}
              </div>

              <h2 className="font-sans font-[450] text-3xl sm:text-4xl lg:text-[44px] tracking-[-0.02em] text-white leading-tight">
                {copy.readyTitle}
              </h2>

              <p className="text-[15.5px] text-white/70 mt-4 leading-relaxed max-w-lg font-normal">
                {copy.readyLead}
              </p>

              {/* Action Button */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-white hover:bg-slate-100 text-[#121317] font-[450] text-[15px] px-8 py-3.5 rounded-full shadow-md active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-2.5"
                >
                  {copy.readyCta}
                  <ArrowRight size={15} weight="bold" />
                </button>
              </div>

              {/* Trust Proof Points / Key Value Bullets */}
              <div className="mt-10 pt-8 border-t border-white/10 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left sm:text-center">
                <div className="flex items-center sm:justify-center gap-2 text-[12.5px] text-white/80">
                  <CheckCircle size={15} weight="fill" className="text-[#34A853] shrink-0" />
                  <span>{copy.ready1}</span>
                </div>
                <div className="flex items-center sm:justify-center gap-2 text-[12.5px] text-white/80">
                  <CheckCircle size={15} weight="fill" className="text-[#34A853] shrink-0" />
                  <span>{copy.ready2}</span>
                </div>
                <div className="flex items-center sm:justify-center gap-2 text-[12.5px] text-white/80">
                  <CheckCircle size={15} weight="fill" className="text-[#34A853] shrink-0" />
                  <span>{copy.ready3}</span>
                </div>
              </div>

              {/* Social Proof Line */}
              <div className="mt-5 text-[12px] text-white/50 font-normal">
                {copy.readySocial}{" "}
                <strong className="text-white/85 font-medium">{copy.readySocialStrong}</strong>{" "}
                {copy.readySocialRest}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
          8. GOOGLE ANTIGRAVITY MINIMALIST FOOTER
          ========================================================================= */}
        <footer className="bg-white border-t border-[rgba(33,34,38,0.06)] px-6 lg:px-12 pt-14 pb-10 text-[#45474D]">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 font-sans font-[450] text-[18px] mb-3 text-[#121317]">
                <svg
                  viewBox="0 0 28 28"
                  width="20"
                  height="20"
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
                PivotAssist
              </div>
              <p className="text-[14px] text-[#45474D] leading-relaxed max-w-sm">
                {copy.footAbout}
              </p>
            </div>

            <div>
              <h4 className="font-sans text-[12px] font-[450] text-[#121317] tracking-tight mb-4">
                {copy.footProduct}
              </h4>
              <ul className="space-y-2.5 text-[14px] text-[#45474D]">
                <li>
                  <Link href="/interview" className="hover:text-[#121317] transition-colors">
                    {copy.footPractice}
                  </Link>
                </li>
                <li>
                  <Link href="/jobs" className="hover:text-[#121317] transition-colors">
                    {copy.footJobs}
                  </Link>
                </li>
                <li>
                  <Link href="/enterprise" className="hover:text-[#121317] transition-colors">
                    {copy.footEnt}
                  </Link>
                </li>
                <li>
                  <Link href="/services" className="hover:text-[#121317] transition-colors">
                    {copy.footPlans}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-sans text-[12px] font-[450] text-[#121317] tracking-tight mb-4">
                {copy.footRes}
              </h4>
              <ul className="space-y-2.5 text-[14px] text-[#45474D]">
                <li>
                  <button
                    type="button"
                    onClick={() => openSupportChat()}
                    className="hover:text-[#121317] transition-colors"
                  >
                    {copy.footSupport}
                  </button>
                </li>
                <li>
                  <Link href="/legal" className="hover:text-[#121317] transition-colors">
                    {copy.footLegalCommit}
                  </Link>
                </li>
                <li>
                  <Link href="/jobs" className="hover:text-[#121317] transition-colors">
                    {copy.footOpenJobs}
                  </Link>
                </li>
                <li>
                  <Link href="/interview" className="hover:text-[#121317] transition-colors">
                    {copy.footPractice}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-sans text-[12px] font-[450] text-[#121317] tracking-tight mb-4">
                {copy.footLegal}
              </h4>
              <ul className="space-y-2.5 text-[14px] text-[#45474D]">
                <li>
                  <Link href="/legal" className="hover:text-[#121317] transition-colors">
                    {copy.footPrivacy}
                  </Link>
                </li>
                <li>
                  <Link href="/face-to-face" className="hover:text-[#121317] transition-colors">
                    {copy.footRoom}
                  </Link>
                </li>
                <li>
                  <Link href="/legal" className="hover:text-[#121317] transition-colors">
                    {copy.footTerms}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-5xl mx-auto border-t border-[rgba(33,34,38,0.06)] pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-[#45474D]">
            <div>
              © {new Date().getFullYear()} PivotAssist. {copy.footRights}
            </div>
            <div className="flex items-center gap-6">
              <Link href="/legal" className="hover:text-[#121317] transition-colors">
                {copy.footSec}
              </Link>
              <Link href="/legal" className="hover:text-[#121317] transition-colors">
                {copy.footTermsShort}
              </Link>
              <button
                type="button"
                onClick={() => openSupportChat()}
                className="hover:text-[#121317] transition-colors"
              >
                {copy.footSupport}
              </button>
            </div>
          </div>
        </footer>
      </main>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
