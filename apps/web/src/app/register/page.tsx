"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User,
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  ArrowRight,
  CheckCircle,
  WarningCircle,
  SpinnerGap,
  Briefcase,
  GraduationCap,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { loginCopy, registerCopy } from "@/lib/i18n-pages";
import { LanguageToggle } from "@/components/LanguageToggle";
import { apiErrorText } from "@/lib/api-errors";

export default function RegisterPage() {
  const { locale } = useLocale();
  const copy = registerCopy[locale];
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CANDIDATE" | "RECRUITER">("CANDIDATE");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg(copy.pwShort);
      return;
    }

    if (!agreeTerms) {
      setErrorMsg(copy.needTerms);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(apiErrorText(data, locale, copy.fail));
        setIsLoading(false);
        return;
      }

      setSuccessMsg(copy.success);
      try {
        if (typeof window !== "undefined" && data?.user) {
          window.sessionStorage.setItem("pivotassist:user", JSON.stringify(data.user));
        }
      } catch {
        // quota
      }
      window.location.assign(role === "RECRUITER" ? "/enterprise/dashboard" : "/home");
    } catch (err: any) {
      setErrorMsg(copy.offline);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#121317] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      {/* Container Box */}
      <div className="w-full max-w-[460px] bg-white rounded-[28px] border border-[rgba(33,34,38,0.08)] p-7 sm:p-9 shadow-[0_8px_30px_rgba(0,0,0,0.04)] animate-in fade-in duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-3.5 group">
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
          <Link
            href="/login"
            className="flex-1 py-1.5 text-[13px] font-[450] rounded-full text-[#45474D] hover:text-[#121317] text-center transition-colors"
          >
            {loginCopy[locale].tabLogin}
          </Link>
          <button
            type="button"
            className="flex-1 py-1.5 text-[13px] font-[450] rounded-full bg-white text-[#121317] shadow-2xs text-center cursor-default"
          >
            {loginCopy[locale].tabRegister}
          </button>
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

        {/* Register Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Role Choice */}
          <div>
            <label className="block text-[12px] font-mono text-[#45474D] uppercase tracking-wider mb-2">
              {copy.purpose}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRole("CANDIDATE")}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                  role === "CANDIDATE"
                    ? "bg-[#E8F0FE] border-[#1A73E8] text-[#121317]"
                    : "bg-[#F8F9FA] border-[rgba(33,34,38,0.08)] text-[#45474D] hover:border-[rgba(33,34,38,0.2)]",
                )}
              >
                <div className="flex items-center gap-1.5 text-[13px] font-[450]">
                  <GraduationCap
                    size={16}
                    weight="bold"
                    className={role === "CANDIDATE" ? "text-[#1A73E8]" : "text-[#45474D]"}
                  />
                  <span>{copy.roleUser}</span>
                </div>
                <span className="text-[11px] text-[#45474D] font-normal leading-tight">
                  {copy.roleUserHint}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRole("RECRUITER")}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                  role === "RECRUITER"
                    ? "bg-[#E8F0FE] border-[#1A73E8] text-[#121317]"
                    : "bg-[#F8F9FA] border-[rgba(33,34,38,0.08)] text-[#45474D] hover:border-[rgba(33,34,38,0.2)]",
                )}
              >
                <div className="flex items-center gap-1.5 text-[13px] font-[450]">
                  <Briefcase
                    size={16}
                    weight="bold"
                    className={role === "RECRUITER" ? "text-[#1A73E8]" : "text-[#45474D]"}
                  />
                  <span>{copy.roleEnt}</span>
                </div>
                <span className="text-[11px] text-[#45474D] font-normal leading-tight">
                  {copy.roleEntHint}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-[450] text-[#121317] mb-1.5">
              {copy.name}
            </label>
            <div className="relative">
              <User
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45474D]"
              />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={copy.namePh}
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.14)] focus:border-[#1A73E8] rounded-2xl pl-10 pr-4 py-2.5 text-[13.5px] text-[#121317] placeholder:text-[#45474D]/60 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
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

          <div>
            <label className="block text-[12.5px] font-[450] text-[#121317] mb-1.5">
              {copy.password}
            </label>
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
                placeholder={copy.passwordPh}
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

          {/* Terms checkbox */}
          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 rounded border-gray-300 text-[#1A73E8] focus:ring-[#1A73E8] cursor-pointer"
            />
            <label
              htmlFor="terms"
              className="text-[12px] text-[#45474D] leading-relaxed cursor-pointer select-none"
            >
              {copy.terms}{" "}
              <a href="/legal" className="text-[#121317] underline">
                {copy.termsLink}
              </a>{" "}
              {copy.and}{" "}
              <a href="/legal" className="text-[#121317] underline">
                {copy.privacyLink}
              </a>{" "}
              {copy.ofBrand}
            </label>
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
                <span>{copy.submit}</span>
                <ArrowRight size={15} weight="bold" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer info */}
      <div className="mt-6 text-center text-[12px] text-[#45474D]">
        <span>{copy.hasAccount} </span>
        <Link href="/login" className="text-[#1A73E8] font-[450] hover:underline">
          {copy.loginNow}
        </Link>
      </div>
    </div>
  );
}
