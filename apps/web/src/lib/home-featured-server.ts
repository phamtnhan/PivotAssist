import { cookies } from "next/headers";
import { prisma } from "@pivotassist/db";
import { isGarbageOrgName } from "@/lib/org-name";
import { employmentTypeLabel, locationLabel } from "@/lib/ui-copy";

export type HomeFeaturedJob = { id: string; title: string; company: string; loc: string };

export async function getFeaturedHomeJobs(): Promise<{ jobs: HomeFeaturedJob[]; total: number }> {
  const locale = (await cookies()).get("pivotassist-locale")?.value === "en" ? "en" : "vi";
  try {
    const where = { isPublished: true, archivedAt: null };
    const [rows, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          location: true,
          employmentType: true,
          company: { select: { name: true } },
        },
      }),
      prisma.job.count({ where }),
    ]);
    return {
      total,
      jobs: rows
        .filter((job) => !isGarbageOrgName(job.company.name))
        .slice(0, 3)
        .map((job) => ({
          id: job.id,
          title: job.title,
          company: job.company.name,
          loc: [
            locationLabel(job.location, locale),
            employmentTypeLabel(job.employmentType, locale),
          ]
            .filter((part) => part && part !== "—")
            .join(" · "),
        })),
    };
  } catch {
    return { jobs: [], total: 0 };
  }
}
