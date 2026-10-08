"use client";

import { useEffect, useState } from "react";
import { EnterpriseAppShell } from "@/components/EnterpriseAppShell";
import {
  BuildingOffice,
  CheckCircle,
  ShieldCheck,
  UploadSimple,
  Users,
  Plus,
  Trash,
  IdentificationCard,
  CreditCard,
  Sparkle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { openSupportChat } from "@/lib/support-chat";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";
import { enterpriseSettingsCopy, fillCopy } from "@/lib/i18n-enterprise";

type MemberRole = "OWNER" | "RECRUITER" | "INTERVIEWER";

interface TeamMember {
  id?: string;
  name: string;
  email: string;
  role: MemberRole;
}

export default function EnterpriseSettingsPage() {
  const { locale } = useLocale();
  const copy = enterpriseSettingsCopy(locale);
  const roleLabel = (role: MemberRole) =>
    role === "OWNER" ? copy.owner : role === "INTERVIEWER" ? copy.interviewer : copy.recruiter;
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<"PENDING" | "VERIFIED" | "REJECTED">(
    "PENDING",
  );
  const [businessModel, setBusinessModel] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [headquarters, setHeadquarters] = useState("");
  const [description, setDescription] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [supportNotice, setSupportNotice] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [usedJobs, setUsedJobs] = useState(0);
  const [maxJobs, setMaxJobs] = useState(0);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"RECRUITER" | "INTERVIEWER">("RECRUITER");
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      const response = await fetch("/api/enterprise/workspace", { cache: "no-store" }).catch(
        () => null,
      );
      const payload = await response?.json().catch(() => null);
      if (cancelled || !response?.ok || !payload?.success) return;
      const workspace = payload.workspace;
      setWorkspaceId(workspace.id ?? "");
      setUsedJobs(typeof workspace.usedJobs === "number" ? workspace.usedJobs : 0);
      setMaxJobs(typeof workspace.maxJobs === "number" ? workspace.maxJobs : 0);
      setCompanyName(workspace.name ?? "");
      setTaxId(workspace.taxId ?? "");
      const status = workspace.verificationStatus;
      setVerificationStatus(status === "VERIFIED" || status === "REJECTED" ? status : "PENDING");
      setBusinessModel(workspace.businessModel ?? "");
      setCompanySize(workspace.companySize ?? "");
      setIndustry(workspace.industry ?? "");
      setHeadquarters(workspace.headquarters ?? "");
      setDescription(workspace.description ?? "");
      setHrEmail(workspace.notificationEmail ?? "");
      setWebsite(workspace.websiteUrl ?? "");
      setTeamMembers(
        (workspace.members ?? []).map(
          (member: {
            id: string;
            user?: { fullName?: string; email?: string };
            role?: string;
          }) => ({
            id: member.id,
            name: member.user?.fullName ?? copy.member,
            email: member.user?.email ?? "",
            role:
              member.role === "OWNER"
                ? "OWNER"
                : member.role === "INTERVIEWER"
                  ? "INTERVIEWER"
                  : "RECRUITER",
          }),
        ),
      );
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    const response = await fetch("/api/enterprise/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: companyName,
        taxId,
        businessModel,
        companySize,
        industry,
        headquarters,
        description,
        notificationEmail: hrEmail,
        websiteUrl: website,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setSettingsError(apiErrorText(payload, locale, copy.saveFail));
      return;
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim() || !newMemberName.trim()) return;
    const response = await fetch("/api/enterprise/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: newMemberName.trim(),
        email: newMemberEmail.trim(),
        role: newMemberRole,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setSettingsError(apiErrorText(payload, locale, copy.addFail));
      return;
    }
    setTeamMembers((current) => [
      ...current,
      {
        id: payload.member.id,
        name: newMemberName.trim(),
        email: newMemberEmail.trim(),
        role: newMemberRole,
      },
    ]);
    setNewMemberEmail("");
    setNewMemberName("");
    setNewMemberRole("RECRUITER");
    setShowAddMember(false);
  };

  const removeMember = async (member: TeamMember, index: number) => {
    if (member.id) {
      const response = await fetch(
        `/api/enterprise/workspace/members/${encodeURIComponent(member.id)}`,
        { method: "DELETE" },
      ).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (!response?.ok || !payload?.success) {
        setSettingsError(apiErrorText(payload, locale, copy.delFail));
        return;
      }
    }
    setTeamMembers((current) => current.filter((_, i) => i !== index));
  };

  const handleContactSales = () => {
    openSupportChat(fillCopy(copy.supportMsg, { name: companyName }));
    setSupportNotice(copy.supportOpened);
  };

  return (
    <EnterpriseAppShell>
      <div className="max-w-[1100px] mx-auto animate-in fade-in duration-300 space-y-8 pb-20">
        {settingsError && (
          <div
            className="rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[12.5px] text-[#C5221F]"
            role="alert"
          >
            {settingsError}
          </div>
        )}
        {supportNotice && (
          <div
            className="rounded-2xl border border-[#CEEAD6] bg-[#E6F4EA] px-4 py-3 text-[12.5px] text-[#137333]"
            role="status"
          >
            {supportNotice}
          </div>
        )}

        {/* Header */}
        <div className="border-b border-mist pb-5">
          <div className="flex items-center gap-2 text-[12px] font-bold text-accent-deep uppercase tracking-wider mb-1">
            <Sparkle size={14} weight="fill" />
            <span>{copy.eyebrow}</span>
          </div>
          <h1 className="text-[24px] font-bold text-ink tracking-tight">{copy.title}</h1>
          <p className="text-[13.5px] text-ink-soft mt-1">{copy.lead}</p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-8">
          {/* SECTION 1: LEGAL & COMPANY PROFILE */}
          <div className="bg-white border border-mist rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex items-center justify-between border-b border-mist pb-4">
              <h3 className="font-bold text-[16px] text-ink flex items-center gap-2">
                <BuildingOffice size={18} className="text-accent-deep" />
                {copy.legal}
              </h3>

              {verificationStatus === "VERIFIED" ? (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle size={13} weight="fill" /> {copy.taxOk}
                </span>
              ) : verificationStatus === "REJECTED" ? (
                <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {copy.taxRejected}
                </span>
              ) : (
                <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {copy.taxPending}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">
                  {copy.company} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">
                  {copy.tax}{" "}
                  <span className="text-ink-soft/60 font-normal text-[11.5px]">
                    {copy.optional}
                  </span>
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">
                  Quy mô nhân sự
                </label>
                <input
                  type="text"
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">Ngành nghề</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">Trụ sở chính</label>
                <input
                  type="text"
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">
                Giới thiệu doanh nghiệp
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink leading-relaxed focus:outline-none focus:border-accent-deep transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">
                  {copy.notifyEmail}
                </label>
                <input
                  type="email"
                  value={hrEmail}
                  onChange={(e) => setHrEmail(e.target.value)}
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
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
                  className="w-full bg-paper/60 focus:bg-white border border-mist-dark/70 rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent-deep transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: TEAM MEMBERS & ROLES */}
          <div className="bg-white border border-mist rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-mist pb-4">
              <div>
                <h3 className="font-bold text-[16px] text-ink flex items-center gap-2">
                  <Users size={18} className="text-accent-deep" />
                  {copy.team}
                </h3>
                <p className="text-[12.5px] text-ink-soft mt-0.5">{copy.teamLead}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddMember(!showAddMember)}
                className="bg-accent-deep hover:bg-accent-hover text-white px-3.5 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer shadow-2xs"
              >
                <Plus size={15} weight="bold" /> {copy.addMember}
              </button>
            </div>

            {showAddMember && (
              <div className="bg-paper p-4 rounded-xl border border-mist flex flex-col sm:flex-row items-center gap-3 animate-in fade-in">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder={copy.namePh}
                  className="flex-1 bg-white border border-mist-dark rounded-lg px-3.5 py-2 text-[13.5px] text-ink focus:outline-none focus:border-accent-deep"
                />
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder={copy.emailPh}
                  className="flex-1 bg-white border border-mist-dark rounded-lg px-3.5 py-2 text-[13.5px] text-ink focus:outline-none focus:border-accent-deep"
                />
                <select
                  value={newMemberRole}
                  onChange={(event) =>
                    setNewMemberRole(event.target.value as "RECRUITER" | "INTERVIEWER")
                  }
                  aria-label={copy.role}
                  className="bg-white border border-mist-dark rounded-lg px-3.5 py-2 text-[13px] text-ink focus:outline-none focus:border-accent-deep"
                >
                  <option value="RECRUITER">{copy.recruiter}</option>
                  <option value="INTERVIEWER">{copy.interviewer}</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="bg-ink text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-ink-soft transition-colors w-full sm:w-auto cursor-pointer"
                >
                  {copy.add}
                </button>
              </div>
            )}

            <div className="divide-y divide-mist">
              {teamMembers.map((m, idx) => (
                <div key={idx} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-[14px] text-ink">{m.name}</div>
                    <div className="text-[12px] text-ink-soft">{m.email}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[11.5px] font-bold text-accent-deep bg-accent-deep/10 px-2.5 py-1 rounded-lg">
                      {roleLabel(m.role)}
                    </span>

                    {m.role !== "OWNER" && (
                      <button
                        type="button"
                        onClick={() => void removeMember(m, idx)}
                        className="text-ink-soft/40 hover:text-rose-600 transition-colors p-1"
                        title={copy.remove}
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: SUBSCRIPTION & VAT INVOICE */}
          <div className="bg-white border border-mist rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="font-bold text-[16px] text-ink border-b border-mist pb-3 flex items-center gap-2">
              <CreditCard size={18} className="text-accent-deep" />
              {copy.plan}
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-xl border border-mist">
              <div>
                <div className="font-bold text-[16px] text-ink">{copy.planName}</div>
                <div className="text-[13px] text-ink-soft mt-1">
                  <strong className="text-ink">
                    {fillCopy(copy.planUsage, { used: usedJobs, max: maxJobs })}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleContactSales()}
                className="bg-accent-deep hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl font-bold text-[13px] shadow-xs transition-all cursor-pointer shrink-0"
              >
                {copy.upgrade}
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-2">
            {savedSuccess ? (
              <span className="text-[13px] font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle size={16} weight="fill" /> {copy.saved}
              </span>
            ) : (
              <span className="text-[12px] text-ink-soft">
                {workspaceId ? fillCopy(copy.orgId, { id: workspaceId }) : ""}
              </span>
            )}

            <button
              type="submit"
              className="bg-ink hover:bg-ink-soft text-white px-8 py-3 rounded-xl font-bold text-[13.5px] transition-all cursor-pointer"
            >
              {copy.save}
            </button>
          </div>
        </form>
      </div>
    </EnterpriseAppShell>
  );
}
