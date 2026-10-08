"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  LockKey,
  WarningCircle,
  CheckCircle,
  SpinnerGap,
  ArrowRight,
} from "@phosphor-icons/react";
import { useLocale } from "@/lib/i18n";
import { loginCopy, registerCopy } from "@/lib/i18n-pages";
import { apiErrorText } from "@/lib/api-errors";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const login = loginCopy[locale];
  const register = registerCopy[locale];
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setErrorMsg(null);
      setSuccessMsg(null);
      setResetLink(null);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin
      ? { email, password }
      : { fullName, email, password, role: "CANDIDATE" };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(apiErrorText(data, locale, isLogin ? login.fail : register.fail));
        setIsLoading(false);
        return;
      }

      setSuccessMsg(isLogin ? login.success : register.success);

      try {
        if (typeof window !== "undefined" && data?.user) {
          window.sessionStorage.setItem("pivotassist:user", JSON.stringify(data.user));
        }
      } catch {
        // quota
      }

      const destination =
        data.user?.role === "ADMIN"
          ? "/admin"
          : data.user?.role === "RECRUITER"
            ? "/enterprise/dashboard"
            : "/home";

      setTimeout(() => {
        onClose();
        window.location.assign(destination);
      }, 500);
    } catch {
      setErrorMsg(isLogin ? login.offline : register.offline);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#121317]/65 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative bg-white w-full max-w-[420px] rounded-[28px] border border-[rgba(33,34,38,0.08)] shadow-[0_25px_70px_rgba(0,0,0,0.25)] p-7 sm:p-8 animate-in fade-in zoom-in-95 duration-200 text-[#121317]"
      >
        <button
          onClick={onClose}
          aria-label={login.close}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#45474D] hover:text-[#121317] hover:bg-black/[0.05] transition-all cursor-pointer"
        >
          <X size={18} weight="bold" />
        </button>

        <div className="mb-5 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5 mb-2">
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
              <circle cx="14" cy="16" r="3" fill="#1A73E8" />
            </svg>
            <span
              id="login-modal-title"
              className="font-sans font-[450] text-[20px] tracking-tight text-[#121317]"
            >
              PivotAssist
            </span>
          </div>
          <p className="font-sans text-[13px] text-[#45474D] max-w-[320px] leading-relaxed font-normal">
            {isLogin ? login.modalLoginLead : login.modalRegisterLead}
          </p>
        </div>

        <div className="bg-[#F8F9FA] p-1 rounded-full border border-[rgba(33,34,38,0.06)] flex items-center mb-4">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-[12.5px] font-[450] rounded-full transition-all cursor-pointer ${
              isLogin ? "bg-white text-[#121317] shadow-2xs" : "text-[#45474D] hover:text-[#121317]"
            }`}
          >
            {login.tabLogin}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-[12.5px] font-[450] rounded-full transition-all cursor-pointer ${
              !isLogin
                ? "bg-white text-[#121317] shadow-2xs"
                : "text-[#45474D] hover:text-[#121317]"
            }`}
          >
            {login.tabRegister}
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] text-[12px] font-normal flex items-start gap-2 animate-in fade-in duration-200">
            <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] text-[12px] font-[450] flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle size={16} weight="fill" className="shrink-0 text-[#34A853]" />
            <span>{successMsg}</span>
          </div>
        )}
        {resetLink && (
          <a
            href={resetLink}
            className="mb-4 block rounded-2xl border border-[#D2E3FC] bg-[#E8F0FE] p-3 text-center text-[12px] text-[#174EA6] hover:underline"
          >
            {login.resetLocalLink}
          </a>
        )}

        <form className="space-y-3" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="space-y-1">
              <label className="block text-[12px] font-sans font-[450] text-[#121317]">
                {register.name}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#F8F9FA] border border-[rgba(33,34,38,0.12)] rounded-2xl px-3.5 py-2.5 text-[13px] text-[#121317] focus:outline-none focus:bg-white focus:border-[#1A73E8] transition-all placeholder:text-[#45474D]/50"
                placeholder={register.namePh}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[12px] font-sans font-[450] text-[#121317]">
              {login.email}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#F8F9FA] border border-[rgba(33,34,38,0.12)] rounded-2xl px-3.5 py-2.5 text-[13px] text-[#121317] focus:outline-none focus:bg-white focus:border-[#1A73E8] transition-all placeholder:text-[#45474D]/50"
              placeholder="ban@email.com"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[12px] font-sans font-[450] text-[#121317]">
                {login.password}
              </label>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      if (!email.trim()) {
                        setErrorMsg(login.forgotNeedEmail);
                        return;
                      }
                      const response = await fetch("/api/auth/forgot-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email }),
                      }).catch(() => null);
                      const payload = await response?.json().catch(() => null);
                      if (!response?.ok || !payload?.success) {
                        setErrorMsg(apiErrorText(payload, locale, login.forgotFail));
                        return;
                      }
                      setSuccessMsg(payload.message ?? login.forgotSent);
                      setResetLink(typeof payload.resetUrl === "string" ? payload.resetUrl : null);
                    })();
                  }}
                  className="text-[11.5px] font-sans text-[#1A73E8] hover:underline"
                >
                  {login.forgot}
                </button>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#F8F9FA] border border-[rgba(33,34,38,0.12)] rounded-2xl px-3.5 py-2.5 text-[13px] text-[#121317] focus:outline-none focus:bg-white focus:border-[#1A73E8] transition-all placeholder:text-[#45474D]/50"
              placeholder={isLogin ? "••••••••" : register.passwordPh}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#121317] hover:bg-[#2D3139] disabled:opacity-70 text-white font-[450] text-[13.5px] py-2.5 rounded-full active:scale-[0.98] transition-all shadow-xs mt-2 cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <SpinnerGap size={16} className="animate-spin" />
                <span>{isLogin ? login.loading : register.loading}</span>
              </>
            ) : (
              <>
                <span>{isLogin ? login.submit : register.submit}</span>
                <ArrowRight size={14} weight="bold" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3.5 border-t border-[rgba(33,34,38,0.06)] flex items-center justify-center gap-1.5 text-[11px] text-[#45474D]">
          <LockKey size={13} weight="fill" className="text-[#34A853]" />
          <span>{login.privacy}</span>
        </div>
      </div>
    </div>
  );
}
