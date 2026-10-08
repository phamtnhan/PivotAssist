"use client";

import { useEffect, useState } from "react";
import { AdminAppShell } from "@/components/AdminAppShell";
import {
  BuildingOffice,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  ShieldCheck,
  IdentificationCard,
  Plus,
  Clock,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { adminEnterprisesCopy } from "@/lib/i18n-admin";
import { fillCopy } from "@/lib/i18n-enterprise";

interface EnterpriseRow {
  id: string;
  companyName: string;
  representative: string;
  taxId: string;
  businessModel: "inhouse" | "agency";
  activeJobs: number;
  maxJobs: number;
  status: "verified" | "pending" | "rejected";
  createdDate: string;
}

export default function AdminEnterprisesPage() {
  const { locale } = useLocale();
  const copy = adminEnterprisesCopy(locale);
  const [enterprises, setEnterprises] = useState<EnterpriseRow[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "error">("success");

  useEffect(() => {
    let cancelled = false;
    async function loadCompanies() {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (search.trim()) params.set("q", search.trim());
      if (selectedStatus !== "all")
        params.set(
          "status",
          selectedStatus === "verified"
            ? "VERIFIED"
            : selectedStatus === "rejected"
              ? "REJECTED"
              : "PENDING",
        );
      const response = await fetch(`/api/admin/companies?${params.toString()}`, {
        cache: "no-store",
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (cancelled || !response?.ok || !payload?.success) return;
      setEnterprises(
        (payload.companies ?? []).map(
          (company: {
            id: string;
            name: string;
            taxId?: string | null;
            businessModel?: string | null;
            maxJobs: number;
            verificationStatus: string;
            createdAt: string;
            _count?: { jobs?: number };
          }) => ({
            id: company.id,
            companyName: company.name,
            representative: copy.fallback,
            taxId: company.taxId ?? "—",
            businessModel:
              company.businessModel?.toLowerCase().includes("agency") ||
              company.businessModel?.toLowerCase().includes("headhunt")
                ? "agency"
                : "inhouse",
            activeJobs: company._count?.jobs ?? 0,
            maxJobs: company.maxJobs,
            status:
              company.verificationStatus === "VERIFIED"
                ? "verified"
                : company.verificationStatus === "REJECTED"
                  ? "rejected"
                  : "pending",
            createdDate: new Date(company.createdAt).toLocaleDateString(
              locale === "en" ? "en-GB" : "vi-VN",
            ),
          }),
        ),
      );
      const nextTotalPages = Math.max(1, Number(payload.totalPages ?? 1));
      setTotalPages(nextTotalPages);
      setTotalCompanies(Number(payload.total ?? 0));
      if (page > nextTotalPages) setPage(nextTotalPages);
      setLiveMode(true);
    }
    void loadCompanies();
    return () => {
      cancelled = true;
    };
  }, [copy.fallback, locale, page, search, selectedStatus]);

  const showToast = (msg: string, kind: "success" | "error" = "success") => {
    setToastKind(kind);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredEnterprises = enterprises.filter((e) => {
    const matchesSearch =
      e.companyName.toLowerCase().includes(search.toLowerCase()) || e.taxId.includes(search);
    const matchesStatus = selectedStatus === "all" || e.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const updateCompany = async (
    id: string,
    patch: { verificationStatus?: "VERIFIED" | "REJECTED"; maxJobs?: number },
  ) => {
    if (!liveMode) {
      showToast(copy.fail, "error");
      return false;
    }
    const response = await fetch("/api/admin/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: id, ...patch }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      showToast(payload?.error ?? copy.fail, "error");
      return false;
    }
    return true;
  };

  const handleVerify = async (id: string) => {
    const target = enterprises.find((enterprise) => enterprise.id === id);
    if (!target || !(await updateCompany(id, { verificationStatus: "VERIFIED" }))) return;
    setEnterprises((current) =>
      current.map((enterprise) =>
        enterprise.id === id ? { ...enterprise, status: "verified" } : enterprise,
      ),
    );
    showToast(fillCopy(copy.approvedMsg, { name: target.companyName }));
  };

  const handleReject = async (id: string) => {
    const target = enterprises.find((enterprise) => enterprise.id === id);
    if (!target || !(await updateCompany(id, { verificationStatus: "REJECTED" }))) return;
    setEnterprises((current) =>
      current.map((enterprise) =>
        enterprise.id === id ? { ...enterprise, status: "rejected" } : enterprise,
      ),
    );
    showToast(fillCopy(copy.rejectedMsg, { name: target.companyName }));
  };

  const handleIncreaseQuota = async (id: string) => {
    const target = enterprises.find((enterprise) => enterprise.id === id);
    if (!target || !(await updateCompany(id, { maxJobs: target.maxJobs + 5 }))) return;
    setEnterprises((current) =>
      current.map((enterprise) =>
        enterprise.id === id ? { ...enterprise, maxJobs: enterprise.maxJobs + 5 } : enterprise,
      ),
    );
    showToast(fillCopy(copy.quotaMsg, { name: target.companyName }));
  };

  return (
    <AdminAppShell>
      <div className="max-w-[1240px] mx-auto font-sans space-y-6 pb-20">
        {/* Header */}
        <div className="border-b border-[rgba(33,34,38,0.06)] pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#1A73E8] uppercase tracking-wider mb-1">
              <BuildingOffice size={14} weight="fill" />
              <span>{copy.eyebrow}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-sans font-[450] text-[#121317] tracking-[-0.02em]">
              {copy.title}
            </h1>
            <p className="text-[13.5px] text-[#45474D] mt-1 font-normal">{copy.lead}</p>
          </div>

          {toastMessage && (
            <div
              role="status"
              className={cn(
                "animate-in fade-in slide-in-from-top-2 duration-200 border px-4 py-2 rounded-full text-[12.5px] font-[450] flex items-center gap-2 shadow-xs",
                toastKind === "success"
                  ? "bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]"
                  : "bg-[#FCE8E6] border-[#FAD2CF] text-[#C5221F]",
              )}
            >
              {toastKind === "success" ? (
                <CheckCircle size={15} weight="fill" />
              ) : (
                <XCircle size={15} weight="fill" />
              )}
              <span>{toastMessage}</span>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-md">
              <MagnifyingGlass
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45474D]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={copy.search}
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.12)] rounded-full pl-9 pr-4 py-2 text-[13px] text-[#121317] placeholder:text-[#45474D] focus:outline-none focus:border-[#1A73E8] transition-all"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.12)] rounded-full px-4 py-2 text-[12.5px] text-[#121317] focus:outline-none focus:border-[#1A73E8] cursor-pointer"
            >
              <option value="all">{copy.all}</option>
              <option value="verified">{copy.verified}</option>
              <option value="pending">{copy.pending}</option>
              <option value="rejected">{copy.rejected}</option>
            </select>
          </div>

          <div className="text-[12.5px] text-[#45474D] font-[450] shrink-0">
            {copy.total}:{" "}
            <strong className="text-[#121317] font-mono">{filteredEnterprises.length}</strong> /{" "}
            {totalCompanies} {copy.companies}
          </div>
        </div>

        {/* Table in Antigravity Card */}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-[#F8F9FA]/80 border-b border-[rgba(33,34,38,0.06)] text-[#45474D] text-[11px] font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-6">{copy.colCo}</th>
                  <th className="py-3.5 px-4">{copy.colTax}</th>
                  <th className="py-3.5 px-4">{copy.colModel}</th>
                  <th className="py-3.5 px-4">{copy.colQuota}</th>
                  <th className="py-3.5 px-4">{copy.colStatus}</th>
                  <th className="py-3.5 px-6 text-right">{copy.colAct}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(33,34,38,0.06)]">
                {filteredEnterprises.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F8F9FA]/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-[450] text-[14px] text-[#121317]">{e.companyName}</div>
                      <div className="text-[12px] text-[#45474D] font-normal">
                        {e.representative}
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono font-medium text-[#121317]">{e.taxId}</td>

                    <td className="py-4 px-4">
                      <span className="text-[11.5px] font-[450] bg-[#F8F9FA] px-3 py-1 rounded-full border border-[rgba(33,34,38,0.08)] text-[#121317] inline-block">
                        {e.businessModel === "agency" ? copy.modelAgency : copy.modelIn}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono">
                      <strong className="text-[#121317]">{e.activeJobs}</strong> / {e.maxJobs}{" "}
                      {copy.roles}
                    </td>

                    <td className="py-4 px-4">
                      {e.status === "verified" ? (
                        <span className="bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] text-[11px] font-[450] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle size={12} weight="fill" />
                          {copy.verified}
                        </span>
                      ) : e.status === "pending" ? (
                        <span className="bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3] text-[11px] font-[450] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Clock size={12} />
                          {copy.pending}
                        </span>
                      ) : (
                        <span className="bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF] text-[11px] font-[450] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <XCircle size={12} weight="fill" />
                          {copy.rejected}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {e.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleVerify(e.id)}
                            className="bg-[#137333] hover:bg-[#0d5926] text-white px-3 py-1 rounded-full text-[12px] font-[450] transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle size={13} weight="bold" />
                            <span>{copy.approve}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleIncreaseQuota(e.id)}
                          className="bg-[#F8F9FA] hover:bg-[#121317] hover:text-white text-[#121317] border border-[rgba(33,34,38,0.12)] px-3 py-1 rounded-full text-[12px] font-[450] transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                          title={copy.plusTitle}
                        >
                          <Plus size={12} weight="bold" />
                          <span>{copy.plus5}</span>
                        </button>

                        {e.status !== "rejected" && (
                          <button
                            type="button"
                            onClick={() => handleReject(e.id)}
                            className="bg-white text-[#C5221F] hover:bg-[#FCE8E6] border border-[#FAD2CF] px-3 py-1 rounded-full text-[12px] font-[450] transition-colors cursor-pointer"
                          >
                            {copy.reject}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-[12.5px] text-[#45474D]">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-[rgba(33,34,38,0.12)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#F8F9FA]"
            >
              {copy.previous}
            </button>
            <span>{fillCopy(copy.pageOf, { page, pages: totalPages })}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-full border border-[rgba(33,34,38,0.12)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#F8F9FA]"
            >
              {copy.next}
            </button>
          </div>
        )}
      </div>
    </AdminAppShell>
  );
}
