"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  CheckCircle,
  Circle,
  MapTrifold,
  Target,
} from "@phosphor-icons/react";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";

type Roadmap = {
  targetRole: string;
  progressPercentage: number;
  milestones: Array<{
    phase: string;
    title: string;
    subtitle: string;
    description: string;
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      targetSkill: string;
      estimatedDays: number;
      isCompleted: boolean;
      resources: Array<{
        id: string;
        title: string;
        provider: string;
        url: string;
        type: string;
        estimatedHours: number;
        costType: string;
      }>;
    }>;
  }>;
};

export default function RoadmapPage() {
  const { locale } = useLocale();
  const copy =
    locale === "en"
      ? {
          eyebrow: "CAREER ROADMAP",
          title: "A plan you can actually follow",
          lead: "Work through the milestones, save the resources, and keep your progress tied to the role you want.",
          target: "Target role",
          progress: "Overall progress",
          empty: "Your roadmap has not been created yet.",
          emptyLead:
            "Update your profile and add skills so PivotAssist can prepare a roadmap for your target role.",
          profile: "Update profile",
          retry: "Try again",
          days: "days",
          resources: "Resources",
          open: "Open resource",
          completed: "Completed",
          pending: "To do",
          loadFail: "Could not load your roadmap.",
          updateFail: "Could not update this task.",
        }
      : {
          eyebrow: "LỘ TRÌNH NGHỀ NGHIỆP",
          title: "Một kế hoạch có thể thực hiện được",
          lead: "Hoàn thành từng chặng, lưu lại tài nguyên và theo dõi tiến độ gắn với vị trí bạn muốn.",
          target: "Vị trí mục tiêu",
          progress: "Tiến độ tổng",
          empty: "Bạn chưa có lộ trình nghề nghiệp.",
          emptyLead:
            "Cập nhật hồ sơ và thêm kỹ năng để PivotAssist tạo lộ trình cho vị trí mục tiêu.",
          profile: "Cập nhật hồ sơ",
          retry: "Thử lại",
          days: "ngày",
          resources: "Tài nguyên",
          open: "Mở tài nguyên",
          completed: "Đã hoàn thành",
          pending: "Cần thực hiện",
          loadFail: "Không thể tải lộ trình nghề nghiệp.",
          updateFail: "Không thể cập nhật nhiệm vụ này.",
        };
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/roadmap", { cache: "no-store" }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (response?.status === 404 && payload?.code === "ROADMAP_NOT_FOUND") {
      setRoadmap(null);
      setError(null);
    } else if (!response?.ok || !payload?.success) {
      setError(apiErrorText(payload, locale, copy.loadFail));
      setRoadmap(null);
    } else {
      setRoadmap(payload.roadmap);
    }
    setLoading(false);
  }, [locale, copy.loadFail]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTask = async (taskId: string, isCompleted: boolean) => {
    if (!roadmap || updatingTaskId) return;
    setUpdatingTaskId(taskId);
    const response = await fetch("/api/roadmap", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: taskId, isCompleted: !isCompleted }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setError(apiErrorText(payload, locale, copy.updateFail));
      setUpdatingTaskId(null);
      return;
    }
    setRoadmap((current) =>
      current
        ? {
            ...current,
            progressPercentage:
              typeof payload.progressPercentage === "number"
                ? payload.progressPercentage
                : current.progressPercentage,
            milestones: current.milestones.map((milestone) => ({
              ...milestone,
              tasks: milestone.tasks.map((task) =>
                task.id === taskId
                  ? { ...task, isCompleted: Boolean(payload.step?.isCompleted) }
                  : task,
              ),
            })),
          }
        : current,
    );
    setUpdatingTaskId(null);
  };

  return (
    <main id="main-content" tabIndex={-1} className="max-w-[1240px] mx-auto font-sans pb-24">
      <section className="rounded-[28px] border border-[rgba(33,34,38,0.08)] bg-white p-7 md:p-10 shadow-2xs">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono tracking-[0.18em] text-[#1A73E8]">
              <MapTrifold size={15} weight="fill" />
              <span>{copy.eyebrow}</span>
            </div>
            <h1 className="mt-3 max-w-2xl text-3xl font-[450] tracking-[-0.03em] text-[#121317] md:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#5F6368]">{copy.lead}</p>
          </div>
          {roadmap && (
            <div className="min-w-[190px] rounded-2xl bg-[#F8F9FA] p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#5F6368]">
                {copy.progress}
              </div>
              <div className="mt-2 text-3xl font-[450] text-[#121317]">
                {roadmap.progressPercentage}%
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E8EAED]">
                <div
                  className="h-full rounded-full bg-[#1A73E8] transition-all"
                  style={{ width: `${roadmap.progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {loading && (
        <div className="mt-6 rounded-3xl border border-[rgba(33,34,38,0.08)] bg-white p-8 text-[#5F6368]">
          {locale === "en" ? "Loading roadmap…" : "Đang tải lộ trình…"}
        </div>
      )}
      {!loading && error && (
        <div
          className="mt-6 rounded-3xl border border-[#FAD2CF] bg-[#FCE8E6] p-8 text-[#C5221F]"
          role="alert"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-full bg-[#C5221F] px-4 py-2 text-[13px] text-white"
          >
            {copy.retry}
          </button>
        </div>
      )}
      {!loading && !error && !roadmap && (
        <div className="mt-6 rounded-3xl border border-dashed border-[rgba(33,34,38,0.16)] bg-white p-10 text-center">
          <Target size={36} className="mx-auto text-[#1A73E8]" />
          <h2 className="mt-4 text-xl font-[450] text-[#121317]">{copy.empty}</h2>
          <p className="mx-auto mt-2 max-w-lg text-[14px] leading-6 text-[#5F6368]">
            {copy.emptyLead}
          </p>
          <Link
            href="/profiles"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#121317] px-5 py-2.5 text-[13px] text-white"
          >
            {copy.profile}
            <ArrowRight size={15} />
          </Link>
        </div>
      )}
      {!loading && !error && roadmap && (
        <>
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-[#D2E3FC] bg-[#E8F0FE] px-4 py-3 text-[14px] text-[#174EA6]">
            <Target size={18} />
            <span>
              {copy.target}: <strong>{roadmap.targetRole}</strong>
            </span>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {roadmap.milestones.map((milestone) => (
              <section
                key={milestone.phase}
                className="rounded-3xl border border-[rgba(33,34,38,0.08)] bg-white p-6 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-[450] text-[#121317]">{milestone.title}</h2>
                    <p className="mt-1 text-[12.5px] text-[#5F6368]">{milestone.subtitle}</p>
                  </div>
                  <BookOpenText size={22} className="shrink-0 text-[#1A73E8]" />
                </div>
                <p className="mt-4 min-h-12 text-[13px] leading-6 text-[#5F6368]">
                  {milestone.description ||
                    (locale === "en"
                      ? "Tasks for this milestone will appear here."
                      : "Các nhiệm vụ của chặng này sẽ xuất hiện tại đây.")}
                </p>
                <div className="mt-5 space-y-3">
                  {milestone.tasks.length === 0 ? (
                    <div className="rounded-2xl bg-[#F8F9FA] p-4 text-[13px] text-[#5F6368]">
                      {locale === "en" ? "No tasks yet." : "Chưa có nhiệm vụ."}
                    </div>
                  ) : (
                    milestone.tasks.map((task) => (
                      <article
                        key={task.id}
                        className="rounded-2xl border border-[rgba(33,34,38,0.08)] p-4"
                      >
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => void toggleTask(task.id, task.isCompleted)}
                            disabled={updatingTaskId !== null}
                            aria-pressed={task.isCompleted}
                            aria-label={`${task.isCompleted ? copy.completed : copy.pending}: ${task.title}`}
                            className="mt-0.5 shrink-0 rounded-full text-left disabled:opacity-50"
                          >
                            {task.isCompleted ? (
                              <CheckCircle size={20} weight="fill" className="text-[#137333]" />
                            ) : (
                              <Circle size={20} className="text-[#9AA0A6]" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-[500] text-[#121317]">{task.title}</h3>
                            <p className="mt-1 text-[12.5px] leading-5 text-[#5F6368]">
                              {task.description}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#5F6368]">
                              <span className="rounded-full bg-[#F8F9FA] px-2 py-1">
                                {task.targetSkill}
                              </span>
                              <span className="rounded-full bg-[#F8F9FA] px-2 py-1">
                                {task.estimatedDays} {copy.days}
                              </span>
                              <span className="rounded-full bg-[#F8F9FA] px-2 py-1">
                                {task.isCompleted ? copy.completed : copy.pending}
                              </span>
                            </div>
                            {task.resources.length > 0 && (
                              <div className="mt-3 border-t border-[rgba(33,34,38,0.08)] pt-3">
                                <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-[#5F6368]">
                                  {copy.resources}
                                </div>
                                <div className="space-y-1.5">
                                  {task.resources.map((resource) => (
                                    <a
                                      key={resource.id}
                                      href={resource.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center justify-between gap-3 text-[12.5px] text-[#1A73E8] hover:underline"
                                    >
                                      <span className="truncate">
                                        {resource.title} · {resource.provider}
                                      </span>
                                      <ArrowRight
                                        size={14}
                                        className="shrink-0"
                                        aria-label={copy.open}
                                      />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
