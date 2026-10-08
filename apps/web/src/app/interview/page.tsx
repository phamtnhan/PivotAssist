"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Microphone,
  MagnifyingGlass,
  Heart,
  Brain,
  Sparkle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";
import { locationLabel } from "@/lib/ui-copy";
import { useUser } from "@/lib/useUser";
import { asIdList } from "@/lib/id-list";
import { persistPreferenceList, readLocalIdList, writeLocalIdList } from "@/lib/preference-sync";

interface PracticeTrack {
  id: string;
  title: string;
  companyRef: string;
  location: string;
  category: "frontend" | "backend" | "data" | "qa" | "lead" | "sales" | "other";
  source: "job" | "cv";
  featured?: boolean;
  sampleQuestion: string;
  tags: string[];
  description: string;
  jd?: string;
}

function inferCategory(title: string): PracticeTrack["category"] {
  const value = title.toLowerCase();
  if (
    value.includes("kinh doanh") ||
    value.includes("sales") ||
    value.includes("đàm phán") ||
    value.includes("thương mại")
  )
    return "sales";
  if (value.includes("front") || value.includes("ui") || value.includes("react")) return "frontend";
  if (
    value.includes("back") ||
    value.includes("java") ||
    value.includes("node") ||
    value.includes("golang")
  )
    return "backend";
  if (
    value.includes("data") ||
    value.includes("analyst") ||
    value.includes("ml") ||
    value.includes("ai")
  )
    return "data";
  if (value.includes("qa") || value.includes("test") || value.includes("quality")) return "qa";
  if (value.includes("lead") || value.includes("manager") || value.includes("architect"))
    return "lead";
  return "other";
}

export default function InterviewPracticePage() {
  const { t, locale } = useLocale();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [jobTracks, setJobTracks] = useState<PracticeTrack[]>([]);
  const [cvTrack, setCvTrack] = useState<PracticeTrack | null>(null);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [tracksReady, setTracksReady] = useState(false);

  useEffect(() => {
    setFavoriteIds(readLocalIdList("pivotassist:favoriteTracks"));
    let cancelled = false;
    setTracksReady(false);
    async function loadJobs() {
      try {
        const response = await fetch("/api/jobs?pageSize=12", { cache: "no-store" }).catch(
          () => null,
        );
        const payload = await response?.json().catch(() => null);
        if (cancelled) return;
        if (!response?.ok || !payload?.success) {
          setTracksError(apiErrorText(payload, locale, t("interviewLoadFail")));
          return;
        }
        setJobTracks(
          (payload.jobs ?? []).map(
            (job: {
              id: string;
              title: string;
              companyName?: string;
              location?: string;
              descriptionHtml?: string;
              requiredSkills?: Array<{ name: string }>;
            }) => ({
              id: job.id,
              title: job.title,
              companyRef: job.companyName ?? t("homeCompany"),
              location: locationLabel(job.location ?? "—", locale),
              category: inferCategory(job.title),
              source: "job" as const,
              featured: false,
              sampleQuestion:
                (job.descriptionHtml ?? "")
                  .replace(/<[^>]+>/g, " ")
                  .trim()
                  .slice(0, 180) || t("interviewSampleJob", { title: job.title }),
              tags: (job.requiredSkills ?? []).map((skill) => skill.name).slice(0, 5),
              description: t("interviewDescJob", { title: job.title }),
              jd: job.descriptionHtml ?? "",
            }),
          ),
        );
        const [profileResponse, resumeResponse] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }).catch(() => null),
          fetch("/api/resumes", { cache: "no-store" }).catch(() => null),
        ]);
        const profilePayload = await profileResponse?.json().catch(() => null);
        const resumePayload = await resumeResponse?.json().catch(() => null);
        const active =
          (resumePayload?.resumes ?? []).find((item: { isActive?: boolean }) => item.isActive) ??
          resumePayload?.resumes?.[0];
        const remoteFav = asIdList(profilePayload?.user?.preferencesJson?.favoriteTracks);
        const localFav = readLocalIdList("pivotassist:favoriteTracks");
        const nextFav = remoteFav.length > 0 ? remoteFav : localFav;
        setFavoriteIds(nextFav);
        writeLocalIdList("pivotassist:favoriteTracks", nextFav);
        if (user && remoteFav.length === 0 && localFav.length > 0)
          void persistPreferenceList("favoriteTracks", localFav);
        const title =
          active?.parsed?.currentJobTitle ||
          profilePayload?.user?.profile?.currentJobTitle ||
          profilePayload?.user?.profile?.targetJobTitle;
        if (title) {
          const skills = Array.isArray(active?.parsed?.extractedSkills)
            ? (active.parsed.extractedSkills as string[])
            : [];
          setCvTrack({
            id: "cv-master",
            title,
            companyRef: active?.filename
              ? t("interviewCvFile", { file: active.filename })
              : t("interviewCvBadge"),
            location: profilePayload?.user?.profile?.location ?? "—",
            category: inferCategory(title),
            source: "cv",
            featured: true,
            sampleQuestion:
              typeof active?.parsed?.summary === "string" && active.parsed.summary
                ? active.parsed.summary.slice(0, 180)
                : t("interviewSampleCv", { title }),
            tags: skills.slice(0, 5),
            description: t("interviewDescCv"),
          });
        }
      } finally {
        if (!cancelled) setTracksReady(true);
      }
    }
    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, [locale, t, user]);

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      writeLocalIdList("pivotassist:favoriteTracks", next);
      if (user) void persistPreferenceList("favoriteTracks", next);
      return next;
    });
  };

  const allTracks = [...(cvTrack ? [cvTrack] : []), ...jobTracks];
  const filteredTracks = allTracks.filter((track) => {
    const matchesSearch =
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.companyRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "all" || track.category === selectedCategory;

    const matchesFavorite = !favoritesOnly || favoriteIds.includes(track.id);

    return matchesSearch && matchesCategory && matchesFavorite;
  });

  return (
    <div className="max-w-[1240px] mx-auto animate-in fade-in duration-300 font-sans pb-20">
      {/* =========================================================================
          1. HEADER & ACTION HUB
          ========================================================================= */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(183,191,217,0.14)] text-[#121317] text-[11.5px] font-[450] tracking-tight mb-2.5">
            <Brain size={14} weight="fill" className="text-[#1A73E8]" />
            {t("interviewEyebrow")}
          </div>
          <h1 className="font-sans font-[450] text-3xl sm:text-4xl text-[#121317] tracking-[-0.02em]">
            {t("interviewTitle")}
          </h1>
          <p className="text-[14.5px] text-[#45474D] max-w-2xl leading-relaxed mt-1 font-normal">
            {t("interviewLead")}
          </p>
        </div>

        {/* Quick Launch Button */}
        <Link
          href="/interview/setup"
          className="bg-[#121317] hover:bg-[#2D3139] active:scale-[0.98] text-white px-6 py-3 rounded-full font-[450] text-[13.5px] flex items-center justify-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <Microphone size={16} weight="fill" />
          {t("interviewStart")} <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      {/* =========================================================================
          2. FILTER & SEARCH COMMAND BAR
          ========================================================================= */}
      <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 shadow-2xs mb-8 flex flex-col gap-4">
        {/* Top: Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[rgba(33,34,38,0.06)]">
          {[
            { id: "all", label: t("interviewCatAll") },
            { id: "frontend", label: t("interviewCatFe") },
            { id: "backend", label: t("interviewCatBe") },
            { id: "data", label: t("interviewCatData") },
            { id: "qa", label: t("interviewCatQa") },
            { id: "lead", label: t("interviewCatLead") },
            { id: "sales", label: t("interviewCatSales") },
            { id: "other", label: t("interviewCatOther") },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[12.5px] font-[450] whitespace-nowrap transition-all cursor-pointer",
                selectedCategory === cat.id
                  ? "bg-[#121317] text-white shadow-xs"
                  : "text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04]",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Bottom: Search Input & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlass
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45474D]/70"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("interviewSearch")}
              className="w-full bg-[#F8F9FA] hover:bg-white focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-full pl-10 pr-4 py-2 text-[13px] text-[#121317] placeholder:text-[#45474D]/50 focus:outline-none focus:ring-1 focus:ring-[#1A73E8] transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-[450] border transition-all cursor-pointer",
                favoritesOnly
                  ? "bg-[#FCE8E6] border-[#F8D7DA] text-[#EA4335]"
                  : "bg-white border-[rgba(33,34,38,0.1)] text-[#45474D] hover:text-[#121317]",
              )}
            >
              <Heart
                size={14}
                weight={favoritesOnly ? "fill" : "regular"}
                className={favoritesOnly ? "text-[#EA4335]" : ""}
              />
              {t("interviewSaved")} {favoriteIds.length > 0 && `(${favoriteIds.length})`}
            </button>
            <span className="text-[11.5px] text-[#45474D] hidden sm:inline">
              {t("interviewFavLocal")}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. BENTO TRACKS GRID
          ========================================================================= */}
      {tracksError && (
        <p className="text-[12.5px] text-[#C5221F] mb-4" role="alert">
          {tracksError}
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {!tracksReady ? (
          <p className="text-[13.5px] text-[#45474D] col-span-2">{t("interviewLoading")}</p>
        ) : filteredTracks.length === 0 ? (
          <p className="text-[13.5px] text-[#45474D] col-span-2">{t("interviewEmpty")}</p>
        ) : null}
        {filteredTracks.map((track) => {
          const isFav = favoriteIds.includes(track.id);

          return (
            <SpotlightCard
              key={track.id}
              className={cn(
                "bg-white border rounded-[26px] p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden",
                track.featured
                  ? "border-[rgba(33,34,38,0.15)] ring-1 ring-[#1A73E8]/10"
                  : "border-[rgba(33,34,38,0.08)] hover:border-[rgba(33,34,38,0.2)]",
              )}
              spotlightColor="rgba(66, 133, 244, 0.08)"
            >
              {track.source === "cv" && (
                <div className="absolute top-0 right-0 bg-[#E8F0FE] text-[#174EA6] text-[10.5px] font-[450] uppercase tracking-wider px-3.5 py-1 rounded-bl-xl border-b border-l border-[#D2E3FC]">
                  {t("interviewCvBadge")}
                </div>
              )}

              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[12px] text-[#45474D]">{track.companyRef}</span>
                    </div>

                    <h3 className="font-sans font-[450] text-[17.5px] text-[#121317] group-hover:text-[#1A73E8] transition-colors leading-snug">
                      {track.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => toggleFavorite(track.id)}
                    className="p-2 rounded-full text-[#45474D]/50 hover:text-[#EA4335] hover:bg-[#FCE8E6]/40 transition-colors shrink-0 cursor-pointer"
                    title={isFav ? t("interviewUnsave") : t("interviewSave")}
                  >
                    <Heart
                      size={18}
                      weight={isFav ? "fill" : "regular"}
                      className={isFav ? "text-[#EA4335]" : ""}
                    />
                  </button>
                </div>

                <p className="text-[13px] text-[#45474D] leading-relaxed mb-4 font-normal">
                  {track.description}
                </p>

                {/* Sample Question Box */}
                <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] rounded-2xl p-3.5 mb-4">
                  <div className="text-[10.5px] font-sans text-[#1A73E8] font-[450] mb-1 flex items-center gap-1.5">
                    <Sparkle size={12} weight="fill" />
                    {t("interviewSampleQ")}
                  </div>
                  <p className="text-[13px] text-[#121317] leading-relaxed font-normal italic">
                    “{track.sampleQuestion}”
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {track.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-sans text-[11.5px] text-[#45474D] bg-[#F1F3F4] px-2.5 py-0.5 rounded-full font-normal"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer: Metadata & Action CTA */}
              <div className="flex items-center justify-between pt-4 border-t border-[rgba(33,34,38,0.06)]">
                <Link
                  href={`/interview/setup?role=${encodeURIComponent(track.title)}`}
                  onClick={() => {
                    window.sessionStorage.setItem("pivotassist:practiceRole", track.title);
                    if (track.jd)
                      window.sessionStorage.setItem(
                        "pivotassist:practiceJd",
                        track.jd.slice(0, 20_000),
                      );
                  }}
                  className="bg-[#121317] hover:bg-[#2D3139] text-white px-5 py-2 rounded-full text-[12.5px] font-[450] inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  {t("interviewPracticeNow")} <ArrowRight size={12} weight="bold" />
                </Link>
              </div>
            </SpotlightCard>
          );
        })}
      </div>
    </div>
  );
}
