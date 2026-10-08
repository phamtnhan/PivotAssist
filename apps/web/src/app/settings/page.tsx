"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, ArrowRight, UploadSimple, ShieldCheck, Eye, EyeSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { LanguageToggle } from "@/components/LanguageToggle";
import { openSupportChat } from "@/lib/support-chat";
import { useLocale } from "@/lib/i18n";
import { settingsExtraCopy } from "@/lib/i18n-user";
import { fillCopy } from "@/lib/i18n-enterprise";
import { apiErrorText } from "@/lib/api-errors";

type SettingsTab = "profile" | "security" | "notifications" | "billing" | "support";

export default function SettingsPage() {
  const { user, logout } = useUser();
  const { t, locale } = useLocale();
  const extra = settingsExtraCopy(locale);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (user) {
      if (user.fullName) setFullName(user.fullName);
      if (user.email) setEmail(user.email);
    }
  }, [user]);
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [location, setLocation] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [bio, setBio] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadProfile() {
      const response = await fetch("/api/profile", { cache: "no-store" }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (cancelled || !response?.ok || !payload?.success) return;
      const profile = payload.user?.profile;
      if (payload.user?.fullName) setFullName(payload.user.fullName);
      if (payload.user?.email) setEmail(payload.user.email);
      setPhone(profile?.phone ?? "");
      setLocation(profile?.location ?? "");
      setTargetRole(profile?.targetJobTitle ?? "");
      setBio(profile?.bio ?? "");
      setDob(profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : "");
      const prefs = payload.user?.preferencesJson ?? {};
      if (typeof prefs.emailJobAlerts === "boolean") setEmailJobAlerts(prefs.emailJobAlerts);
      if (typeof prefs.autoApplyAlerts === "boolean") setAutoApplyAlerts(prefs.autoApplyAlerts);
      if (typeof prefs.interviewFeedbackEmail === "boolean")
        setInterviewFeedbackEmail(prefs.interviewFeedbackEmail);
      if (typeof prefs.weeklyDigest === "boolean") setWeeklyDigest(prefs.weeklyDigest);
      if (typeof prefs.twoFactorEnabled === "boolean") setTwoFactorEnabled(prefs.twoFactorEnabled);
      if (typeof prefs.plan === "string") setPlanLabel(prefs.plan);
      if (typeof prefs.remainingSessions === "number")
        setRemainingSessions(prefs.remainingSessions);
      if (typeof prefs.billingProvider === "string") setBillingProvider(prefs.billingProvider);
      setAvatarUrl(payload.user?.avatarUrl ?? null);
      const invoiceResponse = await fetch("/api/billing/invoices", { cache: "no-store" }).catch(
        () => null,
      );
      const invoicePayload = await invoiceResponse?.json().catch(() => null);
      if (!cancelled && invoicePayload?.success) setInvoices(invoicePayload.invoices ?? []);
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Security form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Notifications state
  const [emailJobAlerts, setEmailJobAlerts] = useState(true);
  const [autoApplyAlerts, setAutoApplyAlerts] = useState(false);
  const [interviewFeedbackEmail, setInterviewFeedbackEmail] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [planLabel, setPlanLabel] = useState(extra.inactive);
  const [remainingSessions, setRemainingSessions] = useState(0);
  const [billingProvider, setBillingProvider] = useState("vietqr");
  const [invoices, setInvoices] = useState<
    Array<{
      id: string;
      planId: string;
      amountVnd: number;
      status: string;
      provider: string;
      transferContent: string;
      createdAt: string;
      paidAt?: string | null;
    }>
  >([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [totpSetup, setTotpSetup] = useState<{
    secret: string;
    qrUrl: string;
    otpauthUrl: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        targetJobTitle: targetRole,
        bio,
        phone,
        location,
        dateOfBirth: dob ? `${dob}T00:00:00.000Z` : null,
        preferencesJson: {
          emailJobAlerts,
          autoApplyAlerts,
          interviewFeedbackEmail,
          weeklyDigest,
        },
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setSaveError(apiErrorText(payload, locale, extra.saveFail));
      return;
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleChangePassword = async () => {
    setSaveError(null);
    if (newPassword !== confirmPassword) {
      setSaveError(extra.pwMismatch);
      return;
    }
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setSaveError(apiErrorText(payload, locale, extra.pwFail));
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const persistNotificationPreference = async (
    key: string,
    next: boolean,
    rollback: () => void,
  ) => {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferencesJson: { [key]: next } }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      rollback();
      setSaveError(apiErrorText(payload, locale, extra.saveFail));
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm(extra.delConfirm)) return;
    const response = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setSaveError(apiErrorText(payload, locale, extra.delFail));
      return;
    }
    await logout();
  };

  const planName =
    planLabel === "pro"
      ? extra.planPro
      : planLabel === "starter"
        ? extra.planStarter
        : planLabel === "master"
          ? extra.planMaster
          : extra.planFree;

  return (
    <div className="max-w-[1240px] mx-auto animate-in fade-in duration-300 font-sans pb-24">
      {/* =========================================================================
          1. TOP PROFILE CAPSULE HERO
          ========================================================================= */}
      <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 mb-8 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-16 h-16 rounded-2xl bg-[#121317] text-white text-[22px] font-[450] flex items-center justify-center shadow-xs overflow-hidden">
              {avatarUrl ? (
                // Avatar may be a blob: preview or uploaded URL; next/image does not cover blob:
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                fullName
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(-2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase() || "?"
              )}
            </div>
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-[rgba(33,34,38,0.12)] text-[#121317] flex items-center justify-center cursor-pointer shadow-2xs hover:bg-[#F8F9FA] transition-colors"
              title={extra.changePhoto}
            >
              <UploadSimple size={12} weight="bold" />
              <input
                id="avatar-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append("file", file);
                  const response = await fetch("/api/profile/avatar", {
                    method: "POST",
                    body: form,
                  }).catch(() => null);
                  const payload = await response?.json().catch(() => null);
                  if (!response?.ok || !payload?.success) {
                    setSaveError(apiErrorText(payload, locale, extra.photoFail));
                    return;
                  }
                  setAvatarUrl(payload.avatarUrl);
                  setSavedSuccess(true);
                }}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="font-sans font-[450] text-2xl text-[#121317] leading-tight">
                {fullName}
              </h1>
            </div>
            <div className="text-[13px] text-[#45474D] flex items-center gap-2 font-normal">
              <span>{email}</span>
              <span>•</span>
              <span>{targetRole}</span>
            </div>
          </div>
        </div>

        {/* Current Plan Badge */}
        <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] rounded-2xl p-4 flex items-center justify-between gap-6 shrink-0">
          <div>
            <div className="text-[10.5px] font-[450] text-[#45474D] uppercase tracking-wider font-mono">
              {t("settingsPlan")}
            </div>
            <div className="text-[14.5px] font-[450] text-[#121317]">{planName}</div>
            <div className="text-[11.5px] text-[#45474D] mt-0.5 font-normal">
              {fillCopy(extra.sessionsN, { n: remainingSessions })} · {extra.payChannel}
            </div>
          </div>
          <Link
            href="/services"
            className="bg-white hover:bg-[#121317] hover:text-white text-[#121317] border border-[rgba(33,34,38,0.12)] px-4 py-1.5 rounded-full text-[12px] font-[450] transition-all shrink-0 cursor-pointer shadow-2xs"
          >
            {extra.buyMore}
          </Link>
        </div>
      </div>

      {/* =========================================================================
          2. TAB NAVIGATION BAR
          ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-[rgba(33,34,38,0.06)] pb-4 mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: "profile", label: t("settingsTabProfile") },
          { id: "security", label: t("settingsTabSecurity") },
          { id: "notifications", label: t("settingsTabNotify") },
          { id: "billing", label: t("settingsTabBilling") },
          { id: "support", label: t("settingsTabSupport") },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SettingsTab)}
            className={cn(
              "px-4 py-2 rounded-full text-[13px] font-[450] whitespace-nowrap transition-all cursor-pointer",
              activeTab === tab.id
                ? "bg-[#121317] text-white shadow-xs"
                : "text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =========================================================================
          3. TAB 1: THÔNG TIN CÁ NHÂN & HỒ SƠ
          ========================================================================= */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs">
            <div className="border-b border-[rgba(33,34,38,0.06)] pb-4 mb-6">
              <h2 className="font-sans font-[450] text-lg text-[#121317]">{extra.profileTitle}</h2>
              <p className="text-[13px] text-[#45474D] mt-0.5 font-normal">{extra.profileLead}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Full Name */}
              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.fullName} <span className="text-[#EA4335]">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all font-normal"
                />
              </div>

              {/* Email (Readonly) */}
              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.emailFixed}
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-[#F8F9FA]/60 border border-[rgba(33,34,38,0.06)] rounded-xl px-4 py-2.5 text-[13.5px] text-[#45474D] cursor-not-allowed font-normal"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.phone}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all font-normal"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.dob}
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all cursor-pointer font-normal"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.city}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all font-normal"
                />
              </div>

              {/* Target Job Role */}
              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.targetRole}
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all font-normal"
                />
              </div>
            </div>

            {/* Professional Bio */}
            <div className="mb-6">
              <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                {extra.bio}
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={1000}
                placeholder={extra.bioPh}
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl p-4 text-[13px] text-[#121317] leading-relaxed focus:outline-none transition-all font-normal"
              />
              <div className="text-[11.5px] text-[#45474D] text-right mt-1 font-normal">
                {fillCopy(extra.chars, { n: bio.length })}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                {extra.uiLang}
              </label>
              <LanguageToggle />
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-[rgba(33,34,38,0.06)] flex items-center justify-between">
              {saveError ? (
                <div className="text-[#C5221F] font-[450] text-[13px]" role="alert">
                  {saveError}
                </div>
              ) : savedSuccess ? (
                <div className="flex items-center gap-2 text-[#137333] font-[450] text-[13px]">
                  <Check size={16} weight="bold" /> {extra.savedOk}
                </div>
              ) : (
                <div className="text-[12px] text-[#45474D] font-normal">{extra.saveHint}</div>
              )}

              <button
                type="submit"
                className="bg-[#121317] hover:bg-[#2D3139] active:scale-[0.98] text-white px-7 py-2.5 rounded-full font-[450] text-[13px] shadow-xs transition-all cursor-pointer"
              >
                {extra.save}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* =========================================================================
          4. TAB 2: BẢO MẬT & ĐĂNG NHẬP
          ========================================================================= */}
      {activeTab === "security" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Change Password Form */}
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs">
            <div className="border-b border-[rgba(33,34,38,0.06)] pb-4 mb-6">
              <h2 className="font-sans font-[450] text-lg text-[#121317]">{extra.pwTitle}</h2>
              <p className="text-[13px] text-[#45474D] mt-0.5 font-normal">{extra.pwLead}</p>
            </div>

            <div className="max-w-md space-y-4 mb-6">
              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.pwCurrent}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={extra.pwCurrentPh}
                    className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl pl-4 pr-10 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#45474D] hover:text-[#121317] cursor-pointer"
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.pwNew}
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={extra.pwNewPh}
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all font-normal"
                />
              </div>

              <div>
                <label className="block text-[13px] font-[450] text-[#121317] mb-1.5">
                  {extra.pwConfirm}
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={extra.pwConfirmPh}
                  className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#121317] focus:outline-none transition-all font-normal"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleChangePassword}
              className="bg-[#121317] hover:bg-[#2D3139] text-white px-6 py-2.5 rounded-full font-[450] text-[13px] transition-all cursor-pointer shadow-xs"
            >
              {extra.pwUpdate}
            </button>
          </div>

          {/* Two-Factor Authentication Card */}
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={18} className="text-[#1A73E8]" weight="fill" />
                <h3 className="font-sans font-[450] text-base text-[#121317]">{extra.twoStep}</h3>
              </div>
              <p className="text-[13px] text-[#45474D] max-w-xl leading-relaxed font-normal">
                {twoFactorEnabled ? extra.twoOn : extra.twoOff}
              </p>
              {totpSetup && (
                <div className="mt-4 space-y-3">
                  {/* TOTP otpauth QR is a data: URL */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={totpSetup.qrUrl}
                    alt={extra.twoStep}
                    width={160}
                    height={160}
                    className="rounded-xl border border-mist"
                  />
                  <div className="text-[11.5px] font-mono break-all text-ink-soft">
                    {totpSetup.secret}
                  </div>
                  <input
                    value={totpCode}
                    onChange={(event) =>
                      setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder={extra.code6}
                    className="w-full max-w-xs rounded-xl border border-mist-dark px-3 py-2 text-[13px]"
                  />
                </div>
              )}
              {twoFactorEnabled && (
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(event) => setDisablePassword(event.target.value)}
                  placeholder={extra.pwToOff}
                  className="mt-3 w-full max-w-xs rounded-xl border border-mist-dark px-3 py-2 text-[13px]"
                />
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                setSaveError(null);
                if (twoFactorEnabled) {
                  const code = window.prompt(extra.promptOff);
                  if (!code) return;
                  const response = await fetch("/api/auth/2fa/disable", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password: disablePassword, code }),
                  }).catch(() => null);
                  const payload = await response?.json().catch(() => null);
                  if (!response?.ok || !payload?.success) {
                    setSaveError(apiErrorText(payload, locale, extra.offFail));
                    return;
                  }
                  setTwoFactorEnabled(false);
                  setDisablePassword("");
                  setSavedSuccess(true);
                  return;
                }
                if (!totpSetup) {
                  const response = await fetch("/api/auth/2fa/setup", { method: "POST" }).catch(
                    () => null,
                  );
                  const payload = await response?.json().catch(() => null);
                  if (!response?.ok || !payload?.success) {
                    setSaveError(apiErrorText(payload, locale, extra.startFail));
                    return;
                  }
                  setTotpSetup({
                    secret: payload.secret,
                    qrUrl: payload.qrUrl,
                    otpauthUrl: payload.otpauthUrl,
                  });
                  return;
                }
                const response = await fetch("/api/auth/2fa/confirm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code: totpCode }),
                }).catch(() => null);
                const payload = await response?.json().catch(() => null);
                if (!response?.ok || !payload?.success) {
                  setSaveError(apiErrorText(payload, locale, extra.confirmFail));
                  return;
                }
                setTwoFactorEnabled(true);
                setTotpSetup(null);
                setTotpCode("");
                setSavedSuccess(true);
              }}
              className={cn(
                "px-5 py-2 rounded-full font-[450] text-[12.5px] transition-all shrink-0 cursor-pointer shadow-xs",
                twoFactorEnabled
                  ? "bg-[#FCE8E6] text-[#C5221F] border border-[#F8D7DA]"
                  : "bg-[#121317] text-white hover:bg-[#2D3139]",
              )}
            >
              {twoFactorEnabled ? extra.turnOff : totpSetup ? extra.confirmCode : extra.startTwo}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. TAB 3: TÙY CHỌN THÔNG BÁO & AI
          ========================================================================= */}
      {activeTab === "notifications" && (
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs space-y-6 animate-in fade-in duration-300">
          <div className="border-b border-[rgba(33,34,38,0.06)] pb-4">
            <h2 className="font-sans font-[450] text-lg text-[#121317]">{extra.notifyTitle}</h2>
            <p className="text-[13px] text-[#45474D] mt-0.5 font-normal">{extra.notifyLead}</p>
          </div>

          <div className="divide-y divide-[rgba(33,34,38,0.06)]">
            <div className="py-4 flex items-center justify-between gap-6">
              <div>
                <div className="font-[450] text-[14px] text-[#121317]">{extra.jobsAlert}</div>
                <div className="text-[12.5px] text-[#45474D] mt-0.5 font-normal">
                  {extra.jobsAlertLead}
                </div>
              </div>
              <input
                type="checkbox"
                checked={emailJobAlerts}
                onChange={async () => {
                  const previous = emailJobAlerts;
                  const next = !previous;
                  setEmailJobAlerts(next);
                  await persistNotificationPreference("emailJobAlerts", next, () =>
                    setEmailJobAlerts(previous),
                  );
                }}
                className="w-4 h-4 accent-[#121317] rounded cursor-pointer"
              />
            </div>

            <div className="py-4 flex items-center justify-between gap-6">
              <div>
                <div className="font-[450] text-[14px] text-[#121317]">{extra.noAuto}</div>
                <div className="text-[12.5px] text-[#45474D] mt-0.5 font-normal">
                  {extra.noAutoLead}
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoApplyAlerts}
                onChange={async () => {
                  const previous = autoApplyAlerts;
                  const next = !previous;
                  setAutoApplyAlerts(next);
                  await persistNotificationPreference("autoApplyAlerts", next, () =>
                    setAutoApplyAlerts(previous),
                  );
                }}
                className="w-4 h-4 accent-[#121317] rounded cursor-pointer"
              />
            </div>

            <div className="py-4 flex items-center justify-between gap-6">
              <div>
                <div className="font-[450] text-[14px] text-[#121317]">{extra.reportAlert}</div>
                <div className="text-[12.5px] text-[#45474D] mt-0.5 font-normal">
                  {extra.reportAlertLead}
                </div>
              </div>
              <input
                type="checkbox"
                checked={interviewFeedbackEmail}
                onChange={async () => {
                  const previous = interviewFeedbackEmail;
                  const next = !previous;
                  setInterviewFeedbackEmail(next);
                  await persistNotificationPreference("interviewFeedbackEmail", next, () =>
                    setInterviewFeedbackEmail(previous),
                  );
                }}
                className="w-4 h-4 accent-[#121317] rounded cursor-pointer"
              />
            </div>

            <div className="py-4 flex items-center justify-between gap-6">
              <div>
                <div className="font-[450] text-[14px] text-[#121317]">{extra.digest}</div>
                <div className="text-[12.5px] text-[#45474D] mt-0.5 font-normal">
                  {extra.digestLead}
                </div>
              </div>
              <input
                type="checkbox"
                checked={weeklyDigest}
                onChange={async () => {
                  const previous = weeklyDigest;
                  const next = !previous;
                  setWeeklyDigest(next);
                  await persistNotificationPreference("weeklyDigest", next, () =>
                    setWeeklyDigest(previous),
                  );
                }}
                className="w-4 h-4 accent-[#121317] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. TAB 4: GÓI DỊCH VỤ & LỊCH SỬ GIAO DỊCH
          ========================================================================= */}
      {activeTab === "billing" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Active Subscription Summary */}
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs">
            <div className="border-b border-[rgba(33,34,38,0.06)] pb-4 mb-6">
              <h2 className="font-sans font-[450] text-lg text-[#121317]">{extra.billingTitle}</h2>
              <p className="text-[13px] text-[#45474D] mt-0.5 font-normal">{extra.billingLead}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-[rgba(33,34,38,0.06)]">
                <div className="text-[11px] font-[450] text-[#45474D] uppercase font-mono">
                  {extra.planName}
                </div>
                <div className="text-[16px] font-[450] text-[#121317] mt-0.5">{planName}</div>
              </div>

              <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-[rgba(33,34,38,0.06)]">
                <div className="text-[11px] font-[450] text-[#45474D] uppercase font-mono">
                  {extra.sessionsLeft}
                </div>
                <div className="text-[16px] font-[450] text-[#1A73E8] mt-0.5">
                  {fillCopy(extra.sessionsN, { n: remainingSessions })}
                </div>
              </div>

              <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-[rgba(33,34,38,0.06)]">
                <div className="text-[11px] font-[450] text-[#45474D] uppercase font-mono">
                  {extra.payChannel}
                </div>
                <div className="text-[16px] font-[450] text-[#121317] mt-0.5">
                  {billingProvider}
                </div>
              </div>
            </div>

            <Link
              href="/services"
              className="inline-flex items-center gap-2 bg-[#121317] hover:bg-[#2D3139] text-white px-5 py-2.5 rounded-full font-[450] text-[12.5px] transition-all shadow-xs cursor-pointer"
            >
              {extra.buyMore} <ArrowRight size={13} weight="bold" />
            </Link>
          </div>

          {/* Invoices History Table */}
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs">
            <div className="border-b border-[rgba(33,34,38,0.06)] pb-4 mb-4">
              <h3 className="font-sans font-[450] text-base text-[#121317]">
                {extra.invoiceTitle}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[rgba(33,34,38,0.06)] text-[#45474D] text-[11.5px] font-[450] font-mono">
                    <th className="pb-3">{extra.colOrder}</th>
                    <th className="pb-3">{extra.colPlan}</th>
                    <th className="pb-3">{extra.colDate}</th>
                    <th className="pb-3">{extra.colAmt}</th>
                    <th className="pb-3">{extra.colStatus}</th>
                    <th className="pb-3 text-right">{extra.colDoc}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(33,34,38,0.06)]">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-[#45474D]">
                        {extra.noInvoice}
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="py-3.5 font-[450] text-[#121317]">
                          {invoice.transferContent}
                        </td>
                        <td className="py-3.5 text-[#121317]">{invoice.planId}</td>
                        <td className="py-3.5 text-[#45474D]">
                          {new Date(invoice.createdAt).toLocaleString(
                            locale === "en" ? "en-GB" : "vi-VN",
                          )}
                        </td>
                        <td className="py-3.5 font-[450] text-[#121317]">
                          {invoice.amountVnd.toLocaleString(locale === "en" ? "en-GB" : "vi-VN")}đ
                        </td>
                        <td className="py-3.5">
                          <span className="bg-[#E8F0FE] text-[#185ABC] font-[450] px-2.5 py-0.5 rounded-full border border-[#D2E3FC] text-[11px]">
                            {invoice.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => {
                              window.location.href = `/api/billing/invoice?id=${encodeURIComponent(invoice.id)}`;
                            }}
                            className="text-[#1A73E8] font-[450] hover:underline text-[12px] cursor-pointer"
                          >
                            {extra.downloadInv}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "support" && (
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 space-y-3">
          <h2 className="text-[16px] font-[450] text-[#121317]">{extra.supportTitle}</h2>
          <p className="text-[13.5px] text-[#45474D]">{extra.supportLead}</p>
          <button
            type="button"
            onClick={() => openSupportChat()}
            className="inline-flex items-center gap-2 text-[13.5px] font-[450] text-[#1A73E8]"
          >
            {extra.openChat} <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* =========================================================================
          7. DANGER ZONE
          ========================================================================= */}
      <div className="mt-12 pt-8 border-t border-[rgba(33,34,38,0.06)] space-y-4">
        {/* Sign Out Card */}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-[450] text-[14px] text-[#121317]">{extra.signOutTitle}</div>
            <div className="text-[12.5px] text-[#45474D] mt-0.5 font-normal">
              {extra.signOutLead}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="bg-[#F8F9FA] hover:bg-black/[0.04] text-[#121317] border border-[rgba(33,34,38,0.1)] px-5 py-2 rounded-full font-[450] text-[12.5px] transition-all self-start sm:self-auto cursor-pointer"
          >
            {extra.signOut}
          </button>
        </div>

        {/* Delete Account Card */}
        <div className="bg-[#FCE8E6]/40 border border-[#F8D7DA] rounded-[24px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-[450] text-[14px] text-[#C5221F]">{extra.delTitle}</div>
            <div className="text-[12.5px] text-[#C5221F]/80 mt-0.5 font-normal">
              {extra.delLead}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDeleteAccount}
            className="bg-white hover:bg-[#EA4335] hover:text-white text-[#C5221F] border border-[#F8D7DA] px-5 py-2 rounded-full font-[450] text-[12.5px] transition-all self-start sm:self-auto shadow-2xs cursor-pointer"
          >
            {extra.delBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
