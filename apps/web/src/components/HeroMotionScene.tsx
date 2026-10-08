"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  ArrowRight,
  Sparkle,
  CheckCircle,
  Cpu,
  Waveform,
  ShieldCheck,
  ChartBar,
  LockKey,
  Globe,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { TiltedCard } from "@/components/react-bits/TiltedCard";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { useLocale } from "@/lib/i18n";
import { landingCopy } from "@/lib/i18n-landing";

interface DemoRole {
  id: string;
  label: string;
  role: string;
  company: string;
  question: string;
}

interface HeroMotionSceneProps {
  roles: DemoRole[];
  activeDemo: DemoRole;
  onSelectRole: (role: DemoRole) => void;
  onStart: () => void;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mediaQuery = window.matchMedia(REDUCED_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia(REDUCED_QUERY).matches;
}

export function HeroMotionScene({
  roles,
  activeDemo,
  onSelectRole,
  onStart,
}: HeroMotionSceneProps) {
  const { locale } = useLocale();
  const copy = landingCopy[locale];
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  const lastUserInteractionRef = useRef(0);

  useEffect(() => {
    if (reduceMotion || roles.length <= 1) return;
    const interval = setInterval(() => {
      // Pause auto-rotation if user recently clicked a role (within last 12 seconds)
      if (Date.now() - lastUserInteractionRef.current < 12_000) return;
      const currentIndex = roles.findIndex((r) => r.id === activeDemo.id);
      const nextIndex = (currentIndex + 1) % roles.length;
      onSelectRole(roles[nextIndex]);
    }, 5500);
    return () => clearInterval(interval);
  }, [roles, activeDemo.id, onSelectRole, reduceMotion]);

  const handleSelect = (role: DemoRole) => {
    lastUserInteractionRef.current = Date.now();
    onSelectRole(role);
  };

  return (
    <div className="relative isolate min-h-[560px] lg:min-h-[610px]">
      <div className="relative z-10 flex flex-col gap-4">
        {/* Top Control Bar: Role Selection Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#34A853] animate-pulse" />
            <span className="font-sans text-[12px] font-[450] text-[#45474D]">
              {copy.heroSample}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-[#45474D] mr-1 hidden sm:inline">
              {copy.heroPickRole}
            </span>
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelect(role)}
                aria-pressed={activeDemo.id === role.id}
                className={cn(
                  "rounded-full border px-4 py-1.5 font-sans text-[12.5px] font-[450] tracking-tight transition-all duration-200 active:scale-[0.97] cursor-pointer",
                  activeDemo.id === role.id
                    ? "border-[#121317] bg-[#121317] text-white shadow-xs"
                    : "border-[rgba(33,34,38,0.1)] bg-white text-[#45474D] hover:text-[#121317] hover:border-[rgba(33,34,38,0.2)]",
                )}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3D Tilted Agent Window */}
        <TiltedCard
          captionText={copy.heroCaption}
          rotateAmplitude={5}
          scaleOnHover={1.015}
          className="h-[460px] sm:h-[490px]"
        >
          <div className="relative h-full overflow-hidden rounded-[24px] border border-[rgba(33,34,38,0.1)] bg-white text-[#121317] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06)] flex flex-col justify-between">
            {/* Web App URL Bar Header */}
            <div className="flex items-center justify-between border-b border-[rgba(33,34,38,0.07)] bg-[#F8F9FA] px-5 py-2.5 select-none">
              <div className="flex items-center gap-2 bg-white border border-[rgba(33,34,38,0.08)] px-3 py-1 rounded-full text-[#45474D]">
                <LockKey size={12} className="text-[#45474D]" />
                <span className="font-mono text-[11px] text-[#45474D]">
                  pivotassist.ai/phong-phong-van
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-sans text-[11.5px] text-[#137333] font-[450]">
                <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse" />
                {copy.heroLive}
              </div>
            </div>

            {/* Main Agent Workspace Body */}
            <div className="p-5 sm:p-7 flex-1 flex flex-col justify-between gap-4 overflow-hidden">
              {/* Top Row: AI Interviewer & Voice Stream */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#E8F0FE] flex items-center justify-center text-[#1A73E8]">
                      <Sparkle size={13} weight="fill" />
                    </div>
                    <span className="font-sans font-[450] text-[12px] text-[#121317]">
                      {copy.heroInterviewer}
                    </span>
                    <span className="font-sans text-[11px] text-[#45474D] bg-[#F1F3F4] px-2.5 py-0.5 rounded-full">
                      {copy.heroAnalyze}
                    </span>
                  </div>

                  {/* Audio Synthesis Equalizer */}
                  <div className="flex items-center gap-1.5 text-[11px] text-[#45474D]">
                    <Waveform size={14} className="text-[#4285F4]" />
                    <span className="font-sans text-[11px]">{copy.heroVoice}</span>
                    <div className="flex items-end gap-0.5 h-3 ml-1">
                      {[6, 12, 16, 9, 14, 8, 11].map((h, i) => (
                        <motion.span
                          key={i}
                          className="w-0.5 rounded-full bg-[#4285F4]"
                          animate={reduceMotion ? { height: h } : { height: [h * 0.4, h, h * 0.5] }}
                          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.12 }}
                          style={{ height: h }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Prompt Question Box: Accessible via [aria-live="polite"] for Playwright test */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeDemo.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="rounded-2xl border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] p-4 shadow-2xs"
                    aria-live="polite"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#45474D] mb-1.5">
                      <span className="text-[#1A73E8] font-semibold">
                        {copy.heroSituation} #{activeDemo.id.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[13.5px] font-[450] leading-relaxed text-[#121317]">
                      {activeDemo.question}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Middle Row: 3 Live Evaluation Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Metric 1: tình huống */}
                <div className="rounded-xl border border-[rgba(33,34,38,0.07)] bg-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-[10.5px] text-[#45474D] mb-1">
                    <span className="font-mono text-[10px]">{copy.heroAlign}</span>
                    <CheckCircle size={13} weight="fill" className="text-[#34A853]" />
                  </div>
                  <div className="text-[13px] font-[450] text-[#121317]">{copy.heroAlignVal}</div>
                </div>

                {/* Metric 2: ESCO Competency */}
                <div className="rounded-xl border border-[rgba(33,34,38,0.07)] bg-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-[10.5px] text-[#45474D] mb-1">
                    <span className="font-mono text-[10px]">{copy.heroRubric}</span>
                    <ChartBar size={13} className="text-[#4285F4]" />
                  </div>
                  <div className="text-[13px] font-[450] text-[#121317]">{copy.heroLevel}</div>
                </div>

                {/* Metric 3: Voice Latency */}
                <div className="rounded-xl border border-[rgba(33,34,38,0.07)] bg-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-[10.5px] text-[#45474D] mb-1">
                    <span className="font-mono text-[10px]">{copy.heroSpeed}</span>
                  </div>
                  <div className="text-[13px] font-[450] text-[#121317]">{copy.heroSpeedVal}</div>
                </div>
              </div>

              {/* Bottom Row: Console Footer with Role Match & Action Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(33,34,38,0.06)] pt-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#4285F4]" />
                  <span className="font-sans text-[12.5px] font-[450] text-[#121317]">
                    {activeDemo.role}
                  </span>
                  <span className="text-[#45474D] text-[12px]">•</span>
                  <span className="font-sans text-[12px] text-[#45474D]">{activeDemo.company}</span>
                </div>

                <button
                  type="button"
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-full bg-[#121317] hover:bg-[#2D3139] text-white px-5 py-2 text-[12.5px] font-[450] shadow-xs transition-all active:scale-[0.97] cursor-pointer"
                >
                  <Play size={11} weight="fill" />
                  {copy.heroTry}
                  <ArrowRight size={11} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </TiltedCard>

        {/* 3 Metric Pills below Stage */}
        <div className="grid grid-cols-3 gap-3 mt-1">
          {[
            { label: copy.heroLang, value: copy.heroLangVal, icon: Globe },
            { label: copy.heroSec, value: copy.heroSecVal, icon: ShieldCheck },
            { label: copy.heroScore, value: copy.heroScoreVal, icon: CheckCircle },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <SpotlightCard
                key={item.label}
                className="rounded-2xl border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] p-3.5 shadow-2xs"
                spotlightColor="rgba(66, 133, 244, 0.08)"
              >
                <div className="mb-1 flex items-center justify-between gap-1 text-[#45474D]">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#45474D]">
                    {item.label}
                  </span>
                  <Icon size={14} weight="bold" className="text-[#1A73E8]" />
                </div>
                <div className="text-[13px] font-[450] text-[#121317]">{item.value}</div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
