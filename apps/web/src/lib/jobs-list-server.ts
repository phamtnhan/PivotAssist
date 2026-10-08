import { prisma } from "@pivotassist/db";
import { excerptJobText, toPublicEmploymentType } from "@/lib/public-job";
import { isGarbageOrgName } from "@/lib/org-name";

export type InitialPublicJob = {
  id: string;
  companyName: string;
  title: string;
  location: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "REMOTE";
  salaryRange?: string;
  hiringCount: number;
  department?: string;
  postedAt: string;
  sourceUrl?: string;
  descriptionHtml: string;
  requiredSkills: Array<{ name: string }>;
  niceToHaveSkills: Array<{ name: string }>;
};

export async function getInitialPublicJobs(): Promise<{ jobs: InitialPublicJob[]; total: number }> {
  const t0 = performance.now();
  try {
    const where = {
      isPublished: true,
      archivedAt: null,
      company: { verificationStatus: "VERIFIED" as const },
    };
    const candidates = await prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { id: true, company: { select: { name: true } } },
    });
    const visibleIds = candidates
      .filter((job) => !isGarbageOrgName(job.company.name))
      .map((job) => job.id);
    const pageIds = visibleIds.slice(0, 30);
    const rows =
      pageIds.length === 0
        ? []
        : await prisma.job.findMany({
            where: { id: { in: pageIds } },
            select: {
              id: true,
              title: true,
              location: true,
              employmentType: true,
              salaryRange: true,
              hiringCount: true,
              department: true,
              createdAt: true,
              sourceUrl: true,
              descriptionRaw: true,
              company: { select: { name: true } },
              jobSkills: { include: { skill: { select: { name: true } } } },
            },
          });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const orderedRows = pageIds.flatMap((id) => {
      const row = rowById.get(id);
      return row ? [row] : [];
    });
    const tPrisma = performance.now();
    const jobs = orderedRows.map((job) => ({
      id: job.id,
      companyName: job.company.name,
      title: job.title,
      location: job.location,
      employmentType: toPublicEmploymentType(job.employmentType),
      salaryRange: job.salaryRange ?? undefined,
      hiringCount: job.hiringCount,
      department: job.department ?? undefined,
      postedAt: job.createdAt.toISOString(),
      sourceUrl: job.sourceUrl ?? `/jobs?jobId=${encodeURIComponent(job.id)}`,
      descriptionHtml: excerptJobText(job.descriptionRaw),
      requiredSkills: job.jobSkills
        .filter((item) => item.isRequired)
        .map((item) => ({ name: item.skill.name })),
      niceToHaveSkills: job.jobSkills
        .filter((item) => !item.isRequired)
        .map((item) => ({ name: item.skill.name })),
    }));
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[perf-jobs-ssr] prisma=${(tPrisma - t0).toFixed(1)} map=${(performance.now() - tPrisma).toFixed(1)} total=${(performance.now() - t0).toFixed(1)} jobs=${jobs.length} descBytes=${rows.reduce((sum, job) => sum + (job.descriptionRaw?.length ?? 0), 0)}`,
      );
    }
    return { total: visibleIds.length, jobs };
  } catch {
    return { jobs: [], total: 0 };
  }
}
