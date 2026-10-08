"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BuildingOffice,
  Check,
  ArrowRight,
  UploadSimple,
  Eye,
  EyeSlash,
  Sparkle,
  ShieldCheck,
  Lock,
  Headset,
  Briefcase,
  Users,
  CheckCircle,
  Buildings,
  IdentificationCard,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { enterpriseRegisterCopy, fillCopy } from "@/lib/i18n-enterprise";
import { LanguageToggle } from "@/components/LanguageToggle";
import { apiErrorText } from "@/lib/api-errors";

type BusinessModel = "inhouse" | "agency";

export default function EnterpriseRegisterPage() {
  const { locale } = useLocale();
  const copy = enterpriseRegisterCopy(locale);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Business info
  const [businessModel, setBusinessModel] = useState<BusinessModel>("inhouse");
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [headquarters, setHeadquarters] = useState("");
  const [companyBio, setCompanyBio] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setSubmitError(copy.pwMismatch);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/enterprise/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email: workEmail,
          password,
          companyName,
          taxId,
          companySize,
          industry,
          businessModel: businessModel === "inhouse" ? copy.inhouseValue : copy.agencyValue,
          websiteUrl: website,
          location: headquarters,
          companyBio,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, copy.createFail));
      setIsRegistered(true);
      window.setTimeout(() => {
        window.location.assign("/enterprise/dashboard");
      }, 900);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : copy.createFail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="enterprise-register-page min-h-screen bg-[#F8F9FA] text-ink font-sans selection:bg-accent-deep/20 pb-24 relative overflow-hidden">
      {/* Subtle Prestige Ambient Background Grid */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[420px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(13,148,136,0.08),transparent)] pointer-events-none"></div>

      {/* =========================================================================
          1. TOP ENTERPRISE NAVIGATION HEADER
          ========================================================================= */}
      <header className="border-b border-mist/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1100px] mx-auto px-6 h-[68px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <Sparkle size={18} weight="fill" className="text-accent-deep" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[18px] text-ink tracking-tight">PivotAssist</span>
              <span className="bg-ink/5 border border-mist-dark text-ink text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                {copy.badge}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="text-[13px] text-ink-soft hidden sm:block">
              {copy.haveAccount}{" "}
              <Link href="/login" className="font-bold text-accent-deep hover:underline">
                {copy.signIn}
              </Link>
            </div>
            <LanguageToggle compact />
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. ENTERPRISE AUTHORITY HERO BANNER
          ========================================================================= */}
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-deep/10 text-accent-deep border border-accent-deep/20 text-[11.5px] font-bold uppercase tracking-wider mb-3.5 shadow-2xs">
          <BuildingOffice size={14} weight="fill" />
          {copy.eyebrow}
        </div>

        <h1 className="font-bold text-[28px] sm:text-[34px] text-ink tracking-tight leading-tight mb-3">
          {copy.title}
        </h1>

        <p className="text-[14.5px] text-ink-soft max-w-2xl mx-auto leading-relaxed">{copy.lead}</p>

        <div className="mt-8 pt-6 border-t border-mist/80 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[12.5px] font-bold text-ink-soft">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-soft/60">
            {copy.trust}
          </span>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN ONBOARDING FORM CONTAINER
          ========================================================================= */}
      <div className="max-w-[900px] mx-auto px-4 sm:px-6">
        {isRegistered ? (
          <div className="bg-white border border-mist-dark/80 rounded-2xl p-10 lg:p-14 text-center shadow-[0_4px_24px_rgba(0,0,0,0.03)] animate-in zoom-in-95 duration-300">
            <div className="w-18 h-18 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
              <Check size={36} weight="bold" />
            </div>
            <h2 className="font-bold text-[24px] text-ink mb-2">{copy.readyTitle}</h2>
            <p className="text-[14px] text-ink-soft max-w-lg mx-auto mb-8 leading-relaxed">
              {fillCopy(copy.readyLead, { name: companyName || copy.readyGuest })}
            </p>
            <Link
              href="/enterprise/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-ink hover:bg-ink-soft text-white px-8 py-3.5 rounded-xl font-bold text-[14px] transition-all shadow-sm"
            >
              {copy.goDash} <ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {submitError && (
              <div
                className="flex items-start gap-2 rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[12.5px] text-[#C5221F]"
                role="alert"
              >
                {submitError}
              </div>
            )}

            {/* -------------------------------------------------------------
                SECTION 1: REPRESENTATIVE (Người đại diện tuyển dụng)
                ------------------------------------------------------------- */}
            <div className="bg-white border border-mist-dark/80 rounded-2xl p-6 sm:p-8 shadow-[0_2px_14px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between border-b border-mist pb-4 mb-6">
                <div>
                  <h3 className="font-bold text-[16px] text-ink flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-ink text-white text-[12px] font-bold flex items-center justify-center">
                      1
                    </span>
                    {copy.step1}
                  </h3>
                  <p className="text-[12.5px] text-ink-soft mt-0.5">{copy.step1Lead}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-bold text-ink mb-1.5">
                      {copy.contactName} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={copy.namePh}
                      className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent-deep/10 transition-all placeholder:text-ink-soft/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-ink mb-1.5">
                      {copy.phone} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0901 234 567"
                        className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent-deep/10 transition-all placeholder:text-ink-soft/40"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-ink mb-1.5">
                    {copy.workEmail} <span className="text-rose-500">*</span>
                    <span className="text-ink-soft/60 font-normal ml-1.5 text-[11.5px]">
                      {copy.emailHint}
                    </span>
                  </label>
                  <input
                    type="email"
                    required
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent-deep/10 transition-all placeholder:text-ink-soft/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-bold text-ink mb-1.5">
                      {copy.adminPw} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={copy.pwPh}
                        className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl pl-3.5 pr-10 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all placeholder:text-ink-soft/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft/60 hover:text-ink"
                      >
                        {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-ink mb-1.5">
                      {copy.confirmPw} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={copy.confirmPh}
                        className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl pl-3.5 pr-10 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all placeholder:text-ink-soft/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft/60 hover:text-ink"
                      >
                        {showConfirmPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                SECTION 2: BUSINESS MODEL SELECTION (Mô hình hoạt động)
                ------------------------------------------------------------- */}
            <div className="bg-white border border-mist-dark/80 rounded-2xl p-6 sm:p-8 shadow-[0_2px_14px_rgba(0,0,0,0.02)]">
              <div className="border-b border-mist pb-4 mb-6">
                <h3 className="font-bold text-[16px] text-ink flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-ink text-white text-[12px] font-bold flex items-center justify-center">
                    2
                  </span>
                  {copy.step2} <span className="text-rose-500">*</span>
                </h3>
                <p className="text-[12.5px] text-ink-soft mt-0.5">{copy.step2Lead}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Model A: In-house HR */}
                <div
                  onClick={() => setBusinessModel("inhouse")}
                  className={cn(
                    "p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative",
                    businessModel === "inhouse"
                      ? "border-accent-deep bg-accent-deep/[0.03] shadow-xs ring-2 ring-accent-deep/15"
                      : "border-mist-dark/70 hover:border-mist-dark bg-white",
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-deep/10 text-accent-deep flex items-center justify-center">
                        <BuildingOffice size={22} weight="fill" />
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center",
                          businessModel === "inhouse"
                            ? "border-accent-deep bg-accent-deep text-white"
                            : "border-mist-dark bg-white",
                        )}
                      >
                        {businessModel === "inhouse" && <Check size={12} weight="bold" />}
                      </div>
                    </div>

                    <h4 className="font-bold text-[15px] text-ink mb-1">{copy.inhouse}</h4>
                    <p className="text-[12.5px] text-ink-soft leading-relaxed mb-4">
                      {copy.inhouseLead}
                    </p>

                    <div className="space-y-2 text-[12px] text-ink-soft/90 pt-3 border-t border-mist/60">
                      <div className="flex items-start gap-2">
                        <Check size={14} className="text-accent-deep shrink-0 mt-0.5" />
                        <span>{copy.in1}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check size={14} className="text-accent-deep shrink-0 mt-0.5" />
                        <span>{copy.in2}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check size={14} className="text-accent-deep shrink-0 mt-0.5" />
                        <span>{copy.in3}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model B: Agency / Headhunt */}
                <div
                  onClick={() => setBusinessModel("agency")}
                  className={cn(
                    "p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative",
                    businessModel === "agency"
                      ? "border-accent-deep bg-accent-deep/[0.03] shadow-xs ring-2 ring-accent-deep/15"
                      : "border-mist-dark/70 hover:border-mist-dark bg-white",
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-deep/10 text-accent-deep flex items-center justify-center">
                        <Briefcase size={22} weight="fill" />
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center",
                          businessModel === "agency"
                            ? "border-accent-deep bg-accent-deep text-white"
                            : "border-mist-dark bg-white",
                        )}
                      >
                        {businessModel === "agency" && <Check size={12} weight="bold" />}
                      </div>
                    </div>

                    <h4 className="font-bold text-[15px] text-ink mb-1">{copy.agency}</h4>
                    <p className="text-[12.5px] text-ink-soft leading-relaxed mb-4">
                      {copy.agencyLead}
                    </p>

                    <div className="space-y-2 text-[12px] text-ink-soft/90 pt-3 border-t border-mist/60">
                      <div className="flex items-start gap-2">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{copy.ag1}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{copy.ag2}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{copy.ag3}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                SECTION 3: COMPANY PROFILE & LEGAL DETAILS
                ------------------------------------------------------------- */}
            <div className="bg-white border border-mist-dark/80 rounded-2xl p-6 sm:p-8 shadow-[0_2px_14px_rgba(0,0,0,0.02)]">
              <div className="border-b border-mist pb-4 mb-6">
                <h3 className="font-bold text-[16px] text-ink flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-ink text-white text-[12px] font-bold flex items-center justify-center">
                    3
                  </span>
                  {copy.step3}
                </h3>
                <p className="text-[12.5px] text-ink-soft mt-0.5">{copy.step3Lead}</p>
              </div>

              <div className="space-y-5">
                {/* Logo & Basic Info Row */}
                <div className="flex flex-col sm:flex-row items-start gap-6 pb-2">
                  <label
                    htmlFor="company-logo-input"
                    className="w-22 h-22 rounded-2xl border-2 border-dashed border-mist-dark hover:border-accent-deep bg-paper/50 hover:bg-paper flex flex-col items-center justify-center cursor-pointer relative group overflow-hidden transition-all shrink-0 shadow-2xs"
                  >
                    {logoPreview ? (
                      // Local file preview is a blob: URL
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-ink-soft/60 group-hover:text-accent-deep transition-colors p-2 text-center">
                        <BuildingOffice size={26} />
                        <span className="text-[10px] font-bold mt-1">{copy.uploadLogo}</span>
                      </div>
                    )}
                    <input
                      id="company-logo-input"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-ink-soft max-w-[9rem]">{copy.logoLocalOnly}</p>

                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <label className="block text-[13px] font-bold text-ink mb-1.5">
                        {copy.company} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder={copy.companyPh}
                        className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all placeholder:text-ink-soft/40"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[13px] font-bold text-ink mb-1.5">
                          {copy.tax}{" "}
                          <span className="text-ink-soft/60 font-normal">{copy.optional}</span>
                        </label>
                        <input
                          type="text"
                          value={taxId}
                          onChange={(e) => setTaxId(e.target.value)}
                          placeholder={copy.taxPh}
                          className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all placeholder:text-ink-soft/40"
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-bold text-ink mb-1.5">
                          {copy.size}
                        </label>
                        <select
                          value={companySize}
                          onChange={(e) => setCompanySize(e.target.value)}
                          className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all cursor-pointer text-ink"
                        >
                          <option value="">{copy.sizePick}</option>
                          <option value="1-50">{copy.size1}</option>
                          <option value="50-200">{copy.size2}</option>
                          <option value="200-1000">{copy.size3}</option>
                          <option value="1000+">{copy.size4}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Industry, Website & Headquarters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[13px] font-bold text-ink mb-1.5">
                      {copy.industry}
                    </label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder={copy.industryPh}
                      className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all placeholder:text-ink-soft/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-ink mb-1.5">
                      {copy.website}
                    </label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://company.vn"
                      className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all placeholder:text-ink-soft/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-ink mb-1.5">{copy.hq}</label>
                    <input
                      type="text"
                      value={headquarters}
                      onChange={(e) => setHeadquarters(e.target.value)}
                      placeholder={copy.hqPh}
                      className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all placeholder:text-ink-soft/40"
                    />
                  </div>
                </div>

                {/* Company Bio */}
                <div>
                  <label className="block text-[13px] font-bold text-ink mb-1.5">{copy.bio}</label>
                  <textarea
                    rows={3}
                    value={companyBio}
                    onChange={(e) => setCompanyBio(e.target.value)}
                    placeholder={copy.bioPh}
                    className="w-full bg-paper/50 focus:bg-white border border-mist-dark/70 rounded-xl p-3.5 text-[13.5px] text-ink leading-relaxed focus:outline-none focus:border-accent-deep transition-all placeholder:text-ink-soft/40"
                  />
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                SECTION 4: SUBMIT & ENTERPRISE COMPLIANCE SEALS
                ------------------------------------------------------------- */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-ink hover:bg-ink-soft active:scale-[0.99] text-white py-4 px-6 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2.5 shadow-md shadow-ink/15 transition-all cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span>{copy.creating}</span>
                ) : (
                  <>
                    <span>{copy.create}</span>
                    <ArrowRight size={18} weight="bold" className="text-accent-deep" />
                  </>
                )}
              </button>

              {/* Trust & Guarantee Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-mist/80 text-[12px] text-ink-soft">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0" weight="fill" />
                  <span>{copy.seal1}</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-accent-deep shrink-0" weight="fill" />
                  <span>{copy.seal2}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Headset size={18} className="text-ink shrink-0" weight="fill" />
                  <span>{copy.seal3}</span>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
