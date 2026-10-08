"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EnterpriseAppShell } from "@/components/EnterpriseAppShell";
import { useUser } from "@/lib/useUser";
import {
  Briefcase,
  Sparkle,
  Plus,
  Trash,
  CheckCircle,
  ArrowRight,
  Sliders,
  FileText,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { enterpriseCreateCopy } from "@/lib/i18n-enterprise";
import { apiErrorText } from "@/lib/api-errors";

export default function EnterpriseJobCreatePage() {
  const router = useRouter();
  const { isLoading: isUserLoading } = useUser();
  const { locale } = useLocale();
  const copy = enterpriseCreateCopy(locale);

  // Basic Job Info
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [jobType, setJobType] = useState<"FULL" | "FLEX" | "REMOTE">("FULL");
  const [location, setLocation] = useState("");
  const [salaryRange, setSalaryRange] = useState("");
  const [jdContent, setJdContent] = useState("");

  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [aiRubric, setAiRubric] = useState<
    Array<{ label: string; weight: number; description: string }>
  >([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/enterprise/workspace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!cancelled && response.ok && payload?.success) {
          setVerificationStatus(
            typeof payload.workspace?.verificationStatus === "string"
              ? payload.workspace.verificationStatus
              : null,
          );
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setIsWorkspaceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canPublish = verificationStatus === null || verificationStatus === "VERIFIED";

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    setAiQuestions([...aiQuestions, newQuestion.trim()]);
    setNewQuestion("");
    setShowAddQuestion(false);
  };

  const handleAnalyzeJob = async () => {
    if (jdContent.trim().length < 20) {
      setAiNotice(copy.needDesc);
      return;
    }
    setIsAnalyzing(true);
    setAiNotice(null);
    try {
      const response = await fetch("/api/enterprise/ai/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: jobTitle, descriptionRaw: jdContent }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, copy.analyzeFail));
      setJobTitle(payload.analysis.title || jobTitle);
      setAiQuestions(payload.analysis.interviewQuestions ?? aiQuestions);
      setAiRubric(payload.analysis.rubric ?? []);
      setAiNotice(copy.analyzed);
    } catch (error) {
      setAiNotice(error instanceof Error ? error.message : copy.analyzeFail);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishNotice(null);
    setPublishError(null);
    setIsPublishing(true);

    try {
      if (isUserLoading) {
        throw new Error(copy.sessionWait);
      }

      const response = await fetch("/api/enterprise/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: jobTitle,
          department,
          employmentType:
            jobType === "REMOTE"
              ? copy.typeRemote
              : jobType === "FLEX"
                ? copy.typeFlex
                : copy.typeFull,
          location,
          salaryRange,
          descriptionRaw: jdContent,
          hiringCount: 1,
          rubric:
            aiRubric.length > 0
              ? aiRubric
              : [
                  { label: copy.rTech, weight: 40, description: copy.rTechD },
                  { label: copy.rSit, weight: 30, description: copy.rSitD },
                  { label: copy.rComm, weight: 20, description: copy.rCommD },
                  { label: copy.rOwn, weight: 10, description: copy.rOwnD },
                ],
          interviewQuestions: aiQuestions,
          isPublished: canPublish,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, copy.publishFail));

      setPublishNotice(canPublish ? copy.published : copy.drafted);
      window.setTimeout(() => router.push("/enterprise/dashboard"), 900);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : copy.publishFail);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <EnterpriseAppShell>
      <div className="max-w-[1000px] mx-auto animate-in fade-in duration-300 space-y-8 pb-20">
        {/* Header */}
        <div className="border-b border-mist pb-5">
          <div className="flex items-center gap-2 text-[12px] font-bold text-accent-deep uppercase tracking-wider mb-1">
            <Sparkle size={14} weight="fill" />
            <span>{copy.eyebrow}</span>
          </div>
          <h1 className="text-[24px] font-bold text-ink tracking-tight">{copy.title}</h1>
          <p className="text-[13.5px] text-ink-soft mt-1">{copy.lead}</p>
        </div>

        {publishNotice && (
          <div
            className="flex items-start gap-2 rounded-2xl border border-[#CEEAD6] bg-[#E6F4EA] px-4 py-3 text-[12.5px] text-[#137333]"
            role="status"
            aria-live="polite"
          >
            <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
            <span>{publishNotice}</span>
          </div>
        )}

        {publishError && (
          <div
            className="flex items-start gap-2 rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[12.5px] text-[#C5221F]"
            role="alert"
            aria-live="polite"
          >
            <span className="font-bold mt-0.5 shrink-0">!</span>
            <span>{publishError}</span>
          </div>
        )}

        {!isWorkspaceLoading && verificationStatus && verificationStatus !== "VERIFIED" && (
          <div
            className="flex items-start gap-2 rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[12.5px] text-[#C5221F]"
            role="status"
            aria-live="polite"
          >
            <span className="font-bold mt-0.5 shrink-0">!</span>
            <span>{copy.verificationNotice}</span>
          </div>
        )}

        <form onSubmit={handlePublish} className="space-y-8">
          {/* SECTION 1: BASIC JOB INFORMATION */}
          <div className="bg-white border border-mist rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <h3 className="font-bold text-[16px] text-ink border-b border-mist pb-3 flex items-center gap-2">
              <Briefcase size={18} className="text-accent-deep" />
              {copy.section1}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">
                  {copy.titleLabel} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">{copy.dept}</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">{copy.type}</label>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as "FULL" | "FLEX" | "REMOTE")}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-accent-deep cursor-pointer"
                >
                  <option value="FULL">{copy.typeFull}</option>
                  <option value="FLEX">{copy.typeFlex}</option>
                  <option value="REMOTE">{copy.typeRemote}</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">{copy.loc}</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">{copy.salary}</label>
                <input
                  type="text"
                  value={salaryRange}
                  onChange={(e) => setSalaryRange(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">
                {copy.desc} <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={5}
                required
                value={jdContent}
                onChange={(e) => setJdContent(e.target.value)}
                className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl p-4 text-[13.5px] text-ink leading-relaxed focus:outline-none focus:border-accent-deep transition-all"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleAnalyzeJob()}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent-deep/30 bg-accent-deep/5 px-4 py-2 text-[12px] font-bold text-accent-deep hover:bg-accent-deep hover:text-white disabled:opacity-60 transition-all"
                >
                  <Sparkle size={14} weight="fill" /> {isAnalyzing ? copy.analyzing : copy.analyze}
                </button>
                {aiNotice && (
                  <span className="text-[12px] text-ink-soft" role="status">
                    {aiNotice}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: AI INTERVIEW SCRIPT CUSTOMIZATION */}
          <div className="bg-white border border-mist rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-mist pb-4">
              <div>
                <h3 className="font-bold text-[16px] text-ink flex items-center gap-2">
                  <Sparkle size={18} className="text-accent-deep" weight="fill" />
                  {copy.section2}
                </h3>
                <p className="text-[12.5px] text-ink-soft mt-0.5">{copy.section2Lead}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddQuestion(!showAddQuestion)}
                className="bg-accent-deep hover:bg-accent-hover text-white px-3.5 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto shadow-2xs cursor-pointer"
              >
                <Plus size={15} weight="bold" /> {copy.addQ}
              </button>
            </div>

            {showAddQuestion && (
              <div className="bg-paper p-4 rounded-xl border border-mist flex flex-col sm:flex-row items-center gap-3 animate-in fade-in">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder={copy.qPh}
                  className="flex-1 bg-white border border-mist-dark rounded-lg px-3.5 py-2 text-[13.5px] text-ink focus:outline-none focus:border-accent-deep"
                />
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="bg-ink text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-ink-soft transition-colors w-full sm:w-auto cursor-pointer"
                >
                  {copy.saveQ}
                </button>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-3">
              {aiQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-mist bg-paper/40 flex items-start justify-between gap-3 group hover:border-mist-dark transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-accent-deep/10 text-accent-deep font-bold text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-[13.5px] font-semibold text-ink leading-snug">{q}</p>
                      <span className="text-[11px] text-ink-soft mt-1 inline-block">
                        {copy.rubricHint}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAiQuestions(aiQuestions.filter((_, i) => i !== idx))}
                    className="text-ink-soft/40 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 shrink-0 p-1"
                    title={copy.delQ}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => router.push("/enterprise/dashboard")}
              className="bg-paper hover:bg-mist text-ink border border-mist-dark px-6 py-3 rounded-xl font-bold text-[13.5px] transition-all cursor-pointer"
            >
              {copy.cancel}
            </button>

            <button
              type="submit"
              disabled={isPublishing || isWorkspaceLoading}
              className="bg-accent-deep hover:bg-accent-hover active:scale-[0.99] text-white px-8 py-3 rounded-xl font-bold text-[14px] flex items-center gap-2 shadow-md shadow-accent-deep/20 transition-all cursor-pointer disabled:opacity-70"
            >
              {isPublishing
                ? canPublish
                  ? copy.publishing
                  : copy.saving
                : canPublish
                  ? copy.publish
                  : copy.saveDraft}
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </form>
      </div>
    </EnterpriseAppShell>
  );
}
