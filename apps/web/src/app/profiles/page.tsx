"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  FilePdf,
  UploadSimple,
  CheckCircle,
  Sparkle,
  ArrowRight,
  DownloadSimple,
  Plus,
  Trash,
  GraduationCap,
  Target,
  Printer,
  X,
  FileText,
  Clock,
  Check,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { useLocale } from "@/lib/i18n";
import { profileCopy } from "@/lib/i18n-user";
import { fillCopy } from "@/lib/i18n-enterprise";
import { apiErrorText } from "@/lib/api-errors";
import { SUPPORTED_RESUME_ACCEPT } from "@/lib/resume-formats";

interface SkillItem {
  id?: string;
  name: string;
  level: "Cơ bản" | "Khá" | "Thành thạo" | "Chuyên gia";
  years: number;
}

interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  period: string;
  description: string[];
}

export default function ProfilesPage() {
  const { user, displayName, isLoading: isUserLoading } = useUser();
  const { t, locale } = useLocale();
  const copy = profileCopy(locale);
  const [skillCount, setSkillCount] = useState(0);
  const [ocrAvailable, setOcrAvailable] = useState<boolean | null>(null);
  const [activeCvTab, setActiveCvTab] = useState<"preview" | "skills" | "experience" | "education">(
    "preview",
  );

  // File & Upload State
  const [resumeReady, setResumeReady] = useState(false);
  const [currentFile, setCurrentFile] = useState({
    name: "—",
    size: "—",
    updatedAt: "…",
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSnapshot, setProfileSnapshot] = useState<{
    targetJobTitle?: string;
    location?: string;
    phone?: string;
    headline?: string;
    bio?: string;
  }>({});
  const [parsedPreview, setParsedPreview] = useState("");
  const [parsedProfile, setParsedProfile] = useState<{
    fullName: string | null;
    currentJobTitle: string | null;
    summary: string;
    education: string[];
    email: string | null;
    phone: string | null;
    location: string | null;
    engine?: string;
  }>({
    fullName: null,
    currentJobTitle: null,
    summary: "",
    education: [],
    email: null,
    phone: null,
    location: null,
  });

  const applyParsedResume = (
    resume: {
      id?: string;
      filename?: string;
      fileSizeBytes?: string | number;
      parsedText?: string | null;
      parsed?: {
        extractedSkills?: string[];
        sections?: Record<string, string>;
        currentJobTitle?: string | null;
        fullName?: string | null;
        summary?: string;
        education?: string[];
        email?: string | null;
        phone?: string | null;
        location?: string | null;
        experiences?: Array<{ role: string; company: string; period: string; bullets?: string[] }>;
      } | null;
      parserEngine?: string;
    },
    fileFallback?: File,
  ) => {
    if (resume.id) setResumeId(resume.id);
    if (resume.filename) {
      setCurrentFile({
        name: resume.filename,
        size: `${Math.max(1, Math.round(Number(resume.fileSizeBytes ?? fileFallback?.size ?? 0) / 1024))} KB`,
        updatedAt: fileFallback ? copy.justNow : copy.saved,
      });
    }
    const extracted = Array.isArray(resume.parsed?.extractedSkills)
      ? resume.parsed.extractedSkills
      : [];
    if (extracted.length > 0)
      setSkills(extracted.map((name) => ({ name, level: "Thành thạo" as const, years: 2 })));
    const parsedExperiences = Array.isArray(resume.parsed?.experiences)
      ? resume.parsed.experiences
      : [];
    if (parsedExperiences.length > 0) {
      setExperiences(
        parsedExperiences.map((item, index) => ({
          id: `exp_${index + 1}`,
          role: item.role,
          company: item.company,
          period: item.period,
          description: item.bullets?.length ? item.bullets : [item.role],
        })),
      );
    } else {
      const experienceText =
        resume.parsed?.sections?.experience ??
        resume.parsed?.sections?.work_experience ??
        resume.parsed?.sections?.kinh_nghiem ??
        "";
      if (typeof experienceText === "string" && experienceText.trim()) {
        setExperiences(
          experienceText
            .split(/\n+/)
            .filter(Boolean)
            .slice(0, 8)
            .map((line, index) => ({
              id: `exp_${index + 1}`,
              role: line.slice(0, 80),
              company: resume.parsed?.currentJobTitle ?? copy.fromCv,
              period: copy.periodCv,
              description: [line],
            })),
        );
      }
    }
    setSkillCount(extracted.length);
    setParsedPreview((resume.parsedText ?? "").slice(0, 4000));
    setParsedProfile({
      fullName: resume.parsed?.fullName ?? null,
      currentJobTitle: resume.parsed?.currentJobTitle ?? null,
      summary: resume.parsed?.summary ?? "",
      education: Array.isArray(resume.parsed?.education) ? resume.parsed.education : [],
      email: resume.parsed?.email ?? null,
      phone: resume.parsed?.phone ?? null,
      location: resume.parsed?.location ?? null,
      engine: resume.parserEngine,
    });
    try {
      window.sessionStorage.setItem(
        "pivotassist:home-snap",
        JSON.stringify({
          ...(JSON.parse(window.sessionStorage.getItem("pivotassist:home-snap") || "null") ?? {}),
          hasResume: true,
          resumeName: resume.filename ?? null,
          resumeMeta: {
            fullName: resume.parsed?.fullName ?? null,
            title: resume.parsed?.currentJobTitle ?? null,
            skills: extracted,
          },
        }),
      );
    } catch {
      /* sessionStorage may be blocked */
    }
  };

  const [skills, setSkills] = useState<SkillItem[]>([]);

  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);

  const [newSkillName, setNewSkillName] = useState("");
  const [showAddSkill, setShowAddSkill] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("pivotassist:home-snap");
      const snap = raw
        ? (JSON.parse(raw) as {
            hasResume?: boolean;
            resumeName?: string | null;
            resumeMeta?: { fullName?: string | null; title?: string | null; skills?: string[] };
          })
        : null;
      if (snap?.hasResume) {
        setCurrentFile({
          name: snap.resumeName || copy.saved,
          size: "—",
          updatedAt: copy.saved,
        });
        if (snap.resumeMeta?.fullName || snap.resumeMeta?.title) {
          setParsedProfile((current) => ({
            ...current,
            fullName: snap.resumeMeta?.fullName ?? current.fullName,
            currentJobTitle: snap.resumeMeta?.title ?? current.currentJobTitle,
          }));
        }
        if (Array.isArray(snap.resumeMeta?.skills) && snap.resumeMeta.skills.length > 0) {
          setSkills(
            snap.resumeMeta.skills.map((name) => ({
              name,
              level: "Thành thạo" as const,
              years: 2,
            })),
          );
          setSkillCount(snap.resumeMeta.skills.length);
        }
      }
    } catch {
      /* keep loading label until /api/resumes returns */
    }
  }, [copy.saved]);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user || user.role !== "CANDIDATE") {
      setResumeReady(true);
      setCurrentFile({ name: copy.noFile, size: "—", updatedAt: copy.none });
      return;
    }
    let cancelled = false;
    async function loadResume() {
      try {
        const response = await fetch("/api/resumes", {
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(apiErrorText(payload, locale, copy.loadFail));
        const active =
          (payload.resumes ?? []).find((item: { isActive?: boolean }) => item.isActive) ??
          payload.resumes?.[0];
        if (!cancelled && active) {
          applyParsedResume(active);
        } else if (!cancelled) {
          setCurrentFile({ name: copy.noFile, size: "—", updatedAt: copy.none });
        }
        const runtimeResponse = await fetch("/api/runtime/status", { cache: "no-store" }).catch(
          () => null,
        );
        const runtimePayload = await runtimeResponse?.json().catch(() => null);
        if (!cancelled && runtimePayload?.ocr)
          setOcrAvailable(Boolean(runtimePayload.ocr.tesseractAvailable));
        const profileResponse = await fetch("/api/profile", { cache: "no-store" }).catch(
          () => null,
        );
        const profilePayload = await profileResponse?.json().catch(() => null);
        const storedExperiences = profilePayload?.user?.preferencesJson?.experiences;
        if (!cancelled && Array.isArray(storedExperiences) && storedExperiences.length > 0) {
          setExperiences(storedExperiences);
        }
        if (!cancelled && profilePayload?.user?.profile) {
          setProfileSnapshot({
            targetJobTitle: profilePayload.user.profile.targetJobTitle,
            location: profilePayload.user.profile.location,
            phone: profilePayload.user.profile.phone,
            headline: profilePayload.user.profile.headline,
            bio: profilePayload.user.profile.bio,
          });
        }
        const parsedSkillNames = Array.isArray(active?.parsed?.extractedSkills)
          ? (active.parsed.extractedSkills as string[])
          : [];
        if (parsedSkillNames.length === 0) {
          const skillResponse = await fetch("/api/skills", { cache: "no-store" }).catch(() => null);
          const skillPayload = await skillResponse?.json().catch(() => null);
          if (
            !cancelled &&
            skillResponse?.ok &&
            skillPayload?.success &&
            Array.isArray(skillPayload.skills) &&
            skillPayload.skills.length > 0
          ) {
            setSkills(
              skillPayload.skills.map(
                (item: {
                  id?: string;
                  name: string;
                  levelScore?: number;
                  yearsOfExperience?: number;
                }) => ({
                  id: item.id,
                  name: item.name,
                  level:
                    (item.levelScore ?? 80) >= 90
                      ? ("Chuyên gia" as const)
                      : (item.levelScore ?? 80) >= 75
                        ? ("Thành thạo" as const)
                        : ("Khá" as const),
                  years: item.yearsOfExperience ?? 2,
                }),
              ),
            );
          }
        }
      } catch (error) {
        if (!cancelled) setProfileError(error instanceof Error ? error.message : copy.loadFail);
      } finally {
        if (!cancelled) setResumeReady(true);
      }
    }
    void loadResume();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading, locale, copy.loadFail, copy.noFile, copy.none]);

  // File Upload Processor (Supports Drag & Drop & Browse)
  const processUploadedFile = async (file: File) => {
    const accepted =
      /\.(pdf|md|txt|docx|doc|rtf|png|jpe?g|webp)$/i.test(file.name) ||
      [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/msword",
        "application/rtf",
        "text/rtf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
        "image/webp",
      ].includes(file.type);
    if (!accepted) {
      setProfileError(copy.typeErr);
      return;
    }
    setIsUploading(true);
    setUploadProgress(15);
    setUploadSuccessMessage(null);
    setProfileError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      setUploadProgress(45);
      const response = await fetch("/api/resumes", { method: "POST", body: formData });
      setUploadProgress(80);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, copy.saveFail));
      setUploadProgress(100);
      applyParsedResume({ ...payload.resume, parserEngine: payload.parser?.engine }, file);
      const skillCount =
        payload.parser?.skills?.length ?? payload.resume?.parsed?.extractedSkills?.length ?? 0;
      setUploadSuccessMessage(
        fillCopy(copy.parsedOk, {
          engine: payload.parser?.engine ?? "parser",
          name: file.name,
          chars: payload.parser?.extractedChars ?? 0,
          n: skillCount,
        }),
      );
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : copy.saveFail);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFile(e.target.files[0]);
    }
  };

  // Xuất hồ sơ (văn bản)
  const handleDownloadPDF = () => {
    setIsExporting(true);
    const slug =
      displayName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "") || "PivotAssist_CV";
    const experienceBlock = experiences.length
      ? experiences
          .map(
            (item, index) =>
              `${index + 1}. ${item.role} | ${item.company} (${item.period})\n${item.description.map((line) => `   - ${line}`).join("\n")}`,
          )
          .join("\n\n")
      : copy.noExpPdf;
    const skillsBlock = skills.length
      ? skills.map((item) => item.name).join(", ")
      : copy.noSkillPdf;
    const cvContent = `
================================================================================
                          ${displayName.toUpperCase()}
                      ${profileSnapshot.targetJobTitle ?? copy.applicant}
       ${profileSnapshot.location ?? "—"} | ${user?.email ?? "—"} | ${profileSnapshot.phone ?? "—"}
================================================================================

${copy.pdfSummary}
--------------------------------------------------------------------------------
${profileSnapshot.headline ?? profileSnapshot.bio ?? copy.pdfEmpty}

${copy.pdfExp}
--------------------------------------------------------------------------------
${experienceBlock}

${copy.pdfSkills}
--------------------------------------------------------------------------------
${skillsBlock}

${copy.pdfSource}
--------------------------------------------------------------------------------
${currentFile.name} · ${currentFile.size} · ${currentFile.updatedAt}

================================================================================
${copy.pdfFoot}
================================================================================
      `.trim();

    const blob = new Blob([cvContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}_CV.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExporting(false);
    setShowExportModal(false);
  };

  const handlePrintPDF = () => {
    setShowExportModal(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;
    if (user) {
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSkillName.trim(), levelScore: 80, yearsOfExperience: 2 }),
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (!response?.ok || !payload?.success) {
        setProfileError(apiErrorText(payload, locale, copy.skillFail));
        return;
      }
      setSkills((current) => [
        ...current,
        { id: payload.skill.id, name: newSkillName.trim(), level: "Thành thạo", years: 2 },
      ]);
    } else {
      setSkills([...skills, { name: newSkillName.trim(), level: "Thành thạo", years: 2 }]);
    }
    setNewSkillName("");
    setShowAddSkill(false);
  };

  const handleDeleteSkill = async (skill: SkillItem, index: number) => {
    if (user && skill.id) {
      const response = await fetch(`/api/skills/${encodeURIComponent(skill.id)}`, {
        method: "DELETE",
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (!response?.ok || !payload?.success) {
        setProfileError(apiErrorText(payload, locale, copy.delSkillFail));
        return;
      }
    }
    setSkills((current) => current.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-[1240px] mx-auto font-sans pb-24">
      {/* =========================================================================
          1. Trạng thái CV (không in)
          ========================================================================= */}
      <div className="no-print bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 mb-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-[#FCE8E6] text-[#EA4335] flex items-center justify-center shrink-0 shadow-2xs">
            <FilePdf size={28} weight="fill" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1">
              <h1 className="font-sans font-[450] text-2xl text-[#121317] tracking-[-0.02em]">
                {t("profilesTitle")}
              </h1>
              {!resumeReady && !parsedPreview ? (
                <span className="bg-[#E8F0FE] text-[#174EA6] border border-[#D2E3FC] text-[11px] font-[450] px-2.5 py-0.5 rounded-full">
                  {copy.loadingFile}
                </span>
              ) : parsedPreview ? (
                <span className="bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] text-[11px] font-[450] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle size={13} weight="fill" /> {t("profilesHasCv")}
                </span>
              ) : (
                <span className="bg-[#FEF7E0] text-[#8A4B08] border border-[#FEEFC3] text-[11px] font-[450] px-2.5 py-0.5 rounded-full">
                  {t("profilesNoCv")}
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#45474D] font-normal">
              {copy.currentFile}{" "}
              <strong className="text-[#121317] font-[450]">{currentFile.name}</strong> (
              {currentFile.size} • {currentFile.updatedAt})
            </p>
          </div>
        </div>

        {/* Điểm kỹ năng và thao tác */}
        <div className="flex flex-wrap items-center gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-[rgba(33,34,38,0.06)]">
          <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] rounded-2xl px-4 py-2.5 text-center shrink-0">
            <div className="text-[10.5px] font-[450] text-[#45474D] uppercase tracking-wider font-mono">
              {copy.skillsFromCv}
            </div>
            <div className="text-xl font-[450] text-[#1A73E8]">{skillCount}</div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#121317] hover:bg-[#2D3139] text-white px-5 py-2.5 rounded-full font-[450] text-[12.5px] flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <UploadSimple size={15} weight="bold" /> {copy.uploadNew}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_RESUME_ACCEPT}
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="bg-white hover:bg-[#F8F9FA] text-[#121317] border border-[rgba(33,34,38,0.12)] px-4 py-2.5 rounded-full font-[450] text-[12.5px] flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <DownloadSimple size={15} weight="bold" /> {copy.exportPdf}
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {uploadSuccessMessage && (
        <div className="no-print mb-6 p-4 rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] flex items-center justify-between text-[13px] animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle size={17} weight="fill" className="text-[#34A853]" />
            <span>{uploadSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadSuccessMessage(null)}
            className="text-[#137333]/70 hover:text-[#137333] cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {profileError && (
        <div
          className="no-print mb-6 p-4 rounded-2xl bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] flex items-center justify-between text-[13px]"
          role="alert"
        >
          <span>{profileError}</span>
          <button
            type="button"
            onClick={() => setProfileError(null)}
            className="font-bold"
            aria-label={copy.closeErr}
          >
            ×
          </button>
        </div>
      )}

      {/* =========================================================================
          2. DRAG & DROP PDF ZONE (Interactive HTML5 Drag & Drop)
          ========================================================================= */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "no-print mb-8 rounded-[24px] border-2 border-dashed p-7 transition-all cursor-pointer flex flex-col items-center justify-center text-center",
          isDragging
            ? "border-[#1A73E8] bg-[#E8F0FE]/40 scale-[1.008] shadow-sm"
            : "border-[rgba(33,34,38,0.14)] hover:border-[#1A73E8] bg-[#F8F9FA]/60 hover:bg-[#E8F0FE]/15",
        )}
      >
        {isUploading ? (
          <div className="w-full max-w-md py-4 space-y-3">
            <div className="flex items-center justify-between text-[12.5px] text-[#121317] font-[450]">
              <span className="flex items-center gap-2">
                <Sparkle size={15} weight="fill" className="text-[#1A73E8] animate-spin" />
                {copy.reading}
              </span>
              <span className="font-mono text-[#1A73E8]">{uploadProgress}%</span>
            </div>
            <div className="h-2 w-full bg-[#E8EAED] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1A73E8] rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[11.5px] text-[#45474D]">{copy.readingLead}</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-2xl bg-white border border-[rgba(33,34,38,0.08)] flex items-center justify-center text-[#1A73E8] mb-3 shadow-2xs">
              <FilePdf size={24} weight="fill" />
            </div>
            <div className="font-sans font-[450] text-[15px] text-[#121317] mb-1">
              {isDragging ? copy.dropNow : copy.drop}
            </div>
            <p className="text-[12.5px] text-[#45474D] max-w-md leading-relaxed font-normal mb-3">
              {copy.hint}{" "}
              {ocrAvailable === null ? copy.ocrCheck : ocrAvailable ? copy.ocrYes : copy.ocrNo}.
            </p>
            <span className="text-[11.5px] text-[#1A73E8] font-[450] bg-white border border-[rgba(33,34,38,0.1)] px-3 py-1 rounded-full shadow-2xs">
              {copy.pick}
            </span>
          </>
        )}
      </div>

      {/* =========================================================================
          3. TAB NAVIGATION BAR (no-print)
          ========================================================================= */}
      <div className="no-print flex items-center gap-2 border-b border-[rgba(33,34,38,0.06)] pb-4 mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: "preview", label: copy.tabPreview },
          { id: "skills", label: copy.tabSkills },
          { id: "experience", label: copy.tabExp },
          { id: "education", label: copy.tabEdu },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCvTab(tab.id as any)}
            className={cn(
              "px-4 py-2 rounded-full text-[13px] font-[450] whitespace-nowrap transition-all cursor-pointer",
              activeCvTab === tab.id
                ? "bg-[#121317] text-white shadow-xs"
                : "text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =========================================================================
          4. Xem trước hồ sơ
          ========================================================================= */}
      {activeCvTab === "preview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
          {/* Left 2 Cols: Structured CV Document (Printable Area) */}
          <div className="print-clean lg:col-span-2 bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-8 shadow-2xs space-y-8">
            {/* Header in CV */}
            <div className="border-b border-[rgba(33,34,38,0.06)] pb-6">
              <h2 className="font-sans font-[450] text-2xl text-[#121317]">
                {(parsedProfile.fullName || user?.fullName || copy.noName).toUpperCase()}
              </h2>
              <div className="text-[#1A73E8] font-[450] text-[15px] mt-0.5">
                {parsedProfile.currentJobTitle || profileSnapshot.targetJobTitle || copy.noTitle}
              </div>
              <div className="text-[12.5px] text-[#45474D] flex flex-wrap gap-x-3 gap-y-1 mt-2 font-normal">
                <span>{parsedProfile.location || profileSnapshot.location || copy.noPlace}</span>
                <span>•</span>
                <span>{parsedProfile.email || user?.email || copy.noEmail}</span>
                <span>•</span>
                <span>{parsedProfile.phone || profileSnapshot.phone || copy.noPhone}</span>
              </div>
            </div>

            {/* Professional Summary */}
            <div>
              <h3 className="font-sans font-[450] text-[13px] uppercase tracking-wider text-[#121317] mb-2 font-mono">
                {copy.summaryH}
              </h3>
              <p className="text-[13.5px] text-[#45474D] leading-relaxed font-normal whitespace-pre-wrap">
                {parsedProfile.summary ||
                  profileSnapshot.bio ||
                  (resumeReady ? copy.emptySummary : copy.loadingFile)}
              </p>
            </div>

            {/* Experience in CV */}
            <div>
              <h3 className="font-sans font-[450] text-[13px] uppercase tracking-wider text-[#121317] mb-4 font-mono">
                {copy.expH}
              </h3>
              <div className="space-y-6">
                {experiences.length === 0 ? (
                  <p className="text-[13px] text-[#45474D]">
                    {resumeReady ? copy.noExp : copy.loadingFile}
                  </p>
                ) : null}
                {experiences.map((exp) => (
                  <div key={exp.id} className="relative pl-4 border-l-2 border-[#1A73E8]/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div className="font-sans font-[450] text-[15px] text-[#121317]">
                        {exp.role}
                      </div>
                      <div className="text-[11.5px] font-[450] text-[#45474D] bg-[#F8F9FA] px-2.5 py-0.5 rounded-full border border-[rgba(33,34,38,0.06)] self-start sm:self-auto">
                        {exp.period}
                      </div>
                    </div>
                    <div className="text-[13px] font-[450] text-[#1A73E8] mb-2">{exp.company}</div>
                    <ul className="space-y-1.5 text-[13px] text-[#45474D] list-disc list-inside leading-relaxed font-normal">
                      {exp.description.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills in CV */}
            <div>
              <h3 className="font-sans font-[450] text-[13px] uppercase tracking-wider text-[#121317] mb-3 font-mono">
                {copy.skillsFromCv}
              </h3>
              <div className="flex flex-wrap gap-2">
                {skills.length === 0 ? (
                  <p className="text-[13px] text-[#45474D]">
                    {resumeReady ? copy.noSkill : copy.loadingFile}
                  </p>
                ) : null}
                {skills.map((s, i) => (
                  <span
                    key={i}
                    className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] text-[#121317] text-[12px] font-normal px-3 py-1 rounded-full"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Gợi ý chỉnh hồ sơ (không in) */}
          <div className="no-print space-y-6">
            <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 shadow-2xs">
              <div className="flex items-center gap-2 font-[450] text-[15px] text-[#121317] mb-4">
                <Sparkle size={17} weight="fill" className="text-[#1A73E8]" />
                {copy.tips}
              </div>

              <div className="space-y-3.5 text-[13px]">
                <div className="p-3.5 rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] text-[#0D652D]">
                  <div className="font-[450] mb-1 flex items-center gap-1.5 text-[#137333]">
                    <CheckCircle size={14} weight="fill" /> {copy.kwOk}
                  </div>
                  <p className="text-[12px] text-[#137333] leading-relaxed font-normal">
                    {skills.length > 0
                      ? fillCopy(copy.kwRead, {
                          n: skills.length,
                          list: skills
                            .slice(0, 6)
                            .map((item) => item.name)
                            .join(", "),
                        })
                      : copy.noKw}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FEF7E0] border border-[#FEEFC3] text-[#B06000]">
                  <div className="font-[450] mb-1 flex items-center gap-1.5 text-[#B06000]">
                    <Sparkle size={14} weight="fill" /> {copy.addNums}
                  </div>
                  <p className="text-[12px] text-[#B06000] leading-relaxed font-normal">
                    {copy.addNumsLead}
                  </p>
                </div>

                {parsedPreview ? (
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)]">
                    <div className="font-[450] mb-1.5 text-[#121317]">
                      {copy.parsed}
                      {parsedProfile.engine ? ` · ${parsedProfile.engine}` : ""}
                    </div>
                    <pre className="text-[11.5px] text-[#45474D] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto font-sans">
                      {parsedPreview}
                    </pre>
                  </div>
                ) : null}

                {/* NO EMOJI 🎯 HERE - REPLACED WITH PHOSPHOR TARGET ICON */}
                <div className="p-3.5 rounded-2xl bg-[#E8F0FE] border border-[#D2E3FC] text-[#1A73E8]">
                  <div className="font-[450] mb-1 flex items-center gap-1.5 text-[#1A73E8]">
                    <Target size={15} weight="bold" /> {copy.practiceTip}
                  </div>
                  <p className="text-[12px] text-[#1A73E8] leading-relaxed font-normal">
                    {fillCopy(copy.practiceTipLead, {
                      role: parsedProfile.currentJobTitle
                        ? ` · ${parsedProfile.currentJobTitle}`
                        : "",
                    })}
                  </p>
                  <Link
                    href="/interview/setup"
                    className="inline-flex items-center gap-1 text-[12px] font-[450] text-[#1A73E8] mt-2 hover:underline"
                  >
                    {copy.startNow}
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Practice Link */}
            <div className="bg-[#121317] text-white rounded-[26px] p-6 shadow-xs">
              <h4 className="font-sans font-[450] text-[15px] mb-1">{copy.ready}</h4>
              <p className="text-[12.5px] text-white/70 mb-4 leading-relaxed font-normal">
                {copy.readyLead}
              </p>
              <Link
                href="/interview/setup"
                className="w-full bg-white hover:bg-white/90 text-[#121317] py-2.5 px-4 rounded-full font-[450] text-[12.5px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                {copy.openRoom} <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. TAB CONTENT 2: SKILLS MATRIX (no-print)
          ========================================================================= */}
      {activeCvTab === "skills" && (
        <div className="no-print bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(33,34,38,0.06)] pb-4">
            <div>
              <h2 className="font-sans font-[450] text-lg text-[#121317]">{copy.tabSkills}</h2>
              <p className="text-[13px] text-[#45474D] mt-0.5 font-normal">{copy.skillsHint}</p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddSkill(!showAddSkill)}
              className="bg-[#121317] hover:bg-[#2D3139] text-white px-4 py-2 rounded-full text-[12.5px] font-[450] flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus size={14} weight="bold" /> {copy.addSkill}
            </button>
          </div>

          {showAddSkill && (
            <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-[rgba(33,34,38,0.08)] flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                placeholder={copy.skillPh}
                className="flex-1 bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-full px-4 py-2 text-[13px] text-[#121317] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="bg-[#121317] text-white px-5 py-2 rounded-full font-[450] text-[12.5px] hover:bg-[#2D3139] transition-colors w-full sm:w-auto cursor-pointer"
              >
                {copy.saveSkill}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {skills.map((skill, idx) => (
              <div
                key={idx}
                className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] rounded-2xl p-4 flex items-center justify-between group hover:border-[rgba(33,34,38,0.16)] hover:bg-white transition-all"
              >
                <div>
                  <div className="font-sans font-[450] text-[13.5px] text-[#121317]">
                    {skill.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteSkill(skill, idx)}
                  className="text-[#45474D]/40 hover:text-[#EA4335] transition-colors opacity-0 group-hover:opacity-100 cursor-pointer p-1"
                  title={copy.delSkill}
                >
                  <Trash size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          6. TAB CONTENT 3: WORK EXPERIENCE (no-print)
          ========================================================================= */}
      {activeCvTab === "experience" && (
        <div className="no-print bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs space-y-6 animate-in fade-in duration-300">
          <div className="border-b border-[rgba(33,34,38,0.06)] pb-4">
            <h2 className="font-sans font-[450] text-lg text-[#121317]">{copy.expTitle}</h2>
            <p className="text-[13px] text-[#45474D] mt-0.5 font-normal">{copy.expLead}</p>
          </div>

          <div className="space-y-6">
            {experiences.map((exp) => (
              <div
                key={exp.id}
                className="p-5 rounded-2xl border border-[rgba(33,34,38,0.06)] bg-[#F8F9FA] space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-sans font-[450] text-[15px] text-[#121317]">{exp.role}</h3>
                    <div className="text-[#1A73E8] font-[450] text-[13px]">{exp.company}</div>
                  </div>
                  <span className="text-[11.5px] font-[450] text-[#45474D] bg-white px-3 py-1 rounded-full border border-[rgba(33,34,38,0.06)] self-start sm:self-auto">
                    {exp.period}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[rgba(33,34,38,0.06)] text-[12.5px] text-[#45474D]">
                  {exp.description.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 font-normal">
                      <span className="text-[#1A73E8] font-bold mt-0.5">•</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          7. TAB CONTENT 4: EDUCATION & CERTIFICATES (no-print)
          ========================================================================= */}
      {activeCvTab === "education" && (
        <div className="no-print bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs space-y-6 animate-in fade-in duration-300">
          <div className="border-b border-[rgba(33,34,38,0.06)] pb-4">
            <h2 className="font-sans font-[450] text-lg text-[#121317]">{copy.eduTitle}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(parsedProfile.education.length > 0 ? parsedProfile.education : [copy.noEdu]).map(
              (item) => (
                <div
                  key={item}
                  className="p-5 rounded-2xl border border-[rgba(33,34,38,0.06)] bg-[#F8F9FA] flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-2xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0 mt-0.5">
                    <GraduationCap size={20} weight="fill" />
                  </div>
                  <div>
                    <h3 className="font-sans font-[450] text-[14.5px] text-[#121317]">{item}</h3>
                    <div className="text-[12.5px] text-[#1A73E8] font-[450]">{copy.fromParsed}</div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          8. Hộp thoại xuất file
          ========================================================================= */}
      {showExportModal && (
        <div className="no-print fixed inset-0 bg-[#121317]/65 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] border border-[rgba(33,34,38,0.08)] p-6 sm:p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_70px_rgba(0,0,0,0.25)] my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(33,34,38,0.06)] mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center font-bold">
                  <DownloadSimple size={18} weight="bold" />
                </div>
                <div>
                  <h3 className="font-sans font-[450] text-[16.5px] text-[#121317]">
                    {copy.exportTitle}
                  </h3>
                  <p className="text-[11.5px] text-[#45474D]">{copy.exportLead}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-[#45474D] hover:text-[#121317] p-1.5 rounded-full hover:bg-black/[0.05] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 mb-6">
              <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] space-y-2">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[#45474D]">{copy.format}</span>
                  <strong className="text-[#121317] font-[450]">{copy.formatVal}</strong>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[#45474D]">{copy.paper}</span>
                  <span className="text-[#121317]">{copy.paperVal}</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[#45474D]">{copy.scan}</span>
                  <span className="text-[#137333] font-[450] flex items-center gap-1">
                    <CheckCircle size={14} weight="fill" /> {copy.scanVal}
                  </span>
                </div>
              </div>

              <p className="text-[12px] text-[#45474D] leading-relaxed">{copy.exportHint}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handlePrintPDF}
                className="bg-[#F8F9FA] hover:bg-black/[0.05] text-[#121317] border border-[rgba(33,34,38,0.12)] py-2.5 px-4 rounded-full font-[450] text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer size={16} weight="bold" />
                <span>{copy.printPdf}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="bg-[#121317] hover:bg-[#2D3139] text-white py-2.5 px-4 rounded-full font-[450] text-[13px] flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <DownloadSimple size={16} weight="bold" />
                <span>{isExporting ? copy.exporting : copy.downloadPdf}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
