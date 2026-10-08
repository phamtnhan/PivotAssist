"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkle,
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  WarningCircle,
  SpinnerGap,
  User,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { loginCopy } from "@/lib/i18n-pages";
import { LanguageToggle } from "@/components/LanguageToggle";
import { apiErrorText } from "@/lib/api-errors";

export default function LoginPage() {
  const { locale } = useLocale();
  const copy = loginCopy[locale];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const redirectAfterLogin = (role?: string, userPayload?: unknown) => {
    try {
      if (typeof window !== "undefined" && userPayload) {
        window.sessionStorage.setItem("pivotassist:user", JSON.stringify(userPayload));
      }
    } catch {
      // quota
    }

    const params =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const next = params?.get("next");
    const roleDefault =
      role === "ADMIN" ? "/admin" : role === "RECRUITER" ? "/enterprise/dashboard" : "/home";

    let target = roleDefault;
    if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
      if (role === "CANDIDATE" && (next.startsWith("/enterprise") || next.startsWith("/admin"))) {
        target = roleDefault;
      } else if (role !== "ADMIN" && next.startsWith("/admin")) {
        target = roleDefault;
      } else {
        target = next;
      }
    }

    window.location.assign(target);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setResetLink(null);
    setIsLoading(true);

    try {
      if (pendingToken) {
        const res = await fetch("/api/auth/login/2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pendingToken, code: totpCode }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          setErrorMsg(apiErrorText(data, locale, copy.totpBad));
          setIsLoading(false);
          return;
        }
        setSuccessMsg(copy.success);
        redirectAfterLogin(data.user?.role, data.user);
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(apiErrorText(data, locale, copy.fail));
        setIsLoading(false);
        return;
      }

      if (data.requiresTwoFactor && data.pendingToken) {
        setPendingToken(data.pendingToken);
        setSuccessMsg(data.message ?? copy.totpNeed);
        setIsLoading(false);
        return;
      }

      setSuccessMsg(copy.success);
      redirectAfterLogin(data.user?.role, data.user);
    } catch (err: unknown) {
      setErrorMsg(copy.offline);
      setIsLoading(false);
    }
  };

  const handleDemoRole = async (demoRole: "CANDIDATE" | "RECRUITER" | "ADMIN") => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: demoRole }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error ?? copy.demoEntFail);
      redirectAfterLogin(data.user?.role ?? demoRole, data.user);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : copy.demoEntFail);
      setIsLoading(false);
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[#F8F9FA] text-[#121317] flex flex-col justify-center items-center p-4 sm:p-6 font-sans"
    >
      {/* Container Box */}
      <div className="w-full max-w-[440px] bg-white rounded-[28px] border border-[rgba(33,34,38,0.08)] p-7 sm:p-9 shadow-[0_8px_30px_rgba(0,0,0,0.04)] animate-in fade-in duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
            <div className="w-9 h-9 flex items-center justify-center">
              <svg
                viewBox="0 0 28 28"
                width="30"
                height="30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 3L25 22H3L14 3Z"
                  stroke="#121317"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <circle cx="14" cy="16" r="3.2" fill="#1A73E8" />
              </svg>
            </div>
            <span className="font-sans font-[450] text-[20px] tracking-tight text-[#121317]">
              PivotAssist
            </span>
          </Link>

          <h1 className="text-xl sm:text-2xl font-sans font-[450] text-[#121317] tracking-tight">
            {copy.title}
          </h1>
          <p className="text-[13px] text-[#45474D] mt-1 font-normal">{copy.lead}</p>
          <div className="mt-3">
            <LanguageToggle compact />
          </div>
        </div>

        {/* Tab Switcher: Đăng nhập vs Đăng ký */}
        <div className="bg-[#F8F9FA] p-1 rounded-full border border-[rgba(33,34,38,0.06)] flex items-center mb-6">
          <button
            type="button"
            className="flex-1 py-1.5 text-[13px] font-[450] rounded-full bg-white text-[#121317] shadow-2xs text-center cursor-default"
          >
            {copy.tabLogin}
          </button>
          <Link
            href="/register"
            className="flex-1 py-1.5 text-[13px] font-[450] rounded-full text-[#45474D] hover:text-[#121317] text-center transition-colors"
          >
            {copy.tabRegister}
          </Link>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] text-[12.5px] font-normal flex items-start gap-2.5 animate-in fade-in duration-200">
            <WarningCircle size={17} weight="fill" className="shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] text-[12.5px] font-[450] flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle size={17} weight="fill" className="shrink-0 text-[#34A853]" />
            <span>{successMsg}</span>
          </div>
        )}
        {resetLink && (
          <a
            href={resetLink}
            className="-mt-2 mb-5 block rounded-2xl border border-[#D2E3FC] bg-[#E8F0FE] p-3 text-center text-[12.5px] text-[#174EA6] hover:underline"
          >
            {copy.resetLocalLink}
          </a>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {pendingToken ? (
            <div>
              <label className="block text-[12.5px] font-[450] text-[#121317] mb-1.5">
                {copy.totp}
              </label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.14)] focus:border-[#1A73E8] rounded-2xl px-4 py-2.5 text-[13.5px] text-[#121317] tracking-[0.4em] text-center focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  setPendingToken(null);
                  setTotpCode("");
                  setSuccessMsg(null);
                }}
                className="mt-2 text-[11.5px] text-[#1A73E8] hover:underline"
              >
                {copy.backPassword}
              </button>
            </div>
          ) : null}
          <div className={pendingToken ? "hidden" : undefined}>
            <label className="block text-[12.5px] font-[450] text-[#121317] mb-1.5">
              {copy.email}
            </label>
            <div className="relative">
              <EnvelopeSimple
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45474D]"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@email.com"
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.14)] focus:border-[#1A73E8] rounded-2xl pl-10 pr-4 py-2.5 text-[13.5px] text-[#121317] placeholder:text-[#45474D]/60 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className={pendingToken ? "hidden" : undefined}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-[450] text-[#121317]">{copy.password}</label>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    if (!email.trim()) {
                      setErrorMsg(copy.forgotNeedEmail);
                      return;
                    }
                    const response = await fetch("/api/auth/forgot-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email }),
                    }).catch(() => null);
                    const payload = await response?.json().catch(() => null);
                    if (!response?.ok || !payload?.success) {
                      setErrorMsg(apiErrorText(payload, locale, copy.forgotFail));
                      return;
                    }
                    setSuccessMsg(payload.message ?? copy.forgotSent);
                    setResetLink(typeof payload.resetUrl === "string" ? payload.resetUrl : null);
                  })();
                }}
                className="text-[11.5px] text-[#1A73E8] hover:underline"
              >
                {copy.forgot}
              </button>
            </div>
            <div className="relative">
              <Lock
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45474D]"
              />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.14)] focus:border-[#1A73E8] rounded-2xl pl-10 pr-10 py-2.5 text-[13.5px] text-[#121317] placeholder:text-[#45474D]/60 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#45474D] hover:text-[#121317] cursor-pointer"
                title={showPassword ? copy.hidePw : copy.showPw}
              >
                {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#121317] hover:bg-[#2D3139] disabled:opacity-70 text-white rounded-full py-3 font-[450] text-[13.5px] transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <>
                <SpinnerGap size={17} className="animate-spin" />
                <span>{copy.loading}</span>
              </>
            ) : (
              <>
                <span>{pendingToken ? copy.submit2fa : copy.submit}</span>
                <ArrowRight size={15} weight="bold" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Helper */}
        <div className="mt-6 pt-5 border-t border-[rgba(33,34,38,0.06)] text-center">
          <span className="text-[11.5px] text-[#45474D] block mb-2 font-normal">
            {copy.demoHint}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void handleDemoRole("CANDIDATE")}
              className="px-3 py-1 bg-[#F8F9FA] hover:bg-[#E8F0FE] hover:text-[#1A73E8] border border-[rgba(33,34,38,0.08)] rounded-full text-[11.5px] text-[#121317] transition-colors cursor-pointer"
            >
              {copy.demoUser}
            </button>
            <button
              type="button"
              onClick={() => void handleDemoRole("RECRUITER")}
              className="px-3 py-1 bg-[#F8F9FA] hover:bg-[#E6F4EA] hover:text-[#137333] border border-[rgba(33,34,38,0.08)] rounded-full text-[11.5px] text-[#121317] transition-colors cursor-pointer"
            >
              {copy.demoEnt}
            </button>
            <button
              type="button"
              onClick={() => void handleDemoRole("ADMIN")}
              className="px-3 py-1 bg-[#F8F9FA] hover:bg-[#FCE8E6] hover:text-[#EA4335] border border-[rgba(33,34,38,0.08)] rounded-full text-[11.5px] text-[#121317] transition-colors cursor-pointer"
            >
              {copy.demoAdmin}
            </button>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-6 text-center text-[12px] text-[#45474D]">
        <span>{copy.noAccount} </span>
        <Link href="/register" className="text-[#1A73E8] font-[450] hover:underline">
          {copy.registerNow}
        </Link>
      </div>
    </main>
  );
}
