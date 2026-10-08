import { after, NextRequest, NextResponse } from "next/server";
import { getSessionUser, prisma } from "@/lib/auth";
import { persistJobMatch } from "@/lib/job-match-server";
import { excerptJobText, mapStoredMatch, toPublicEmploymentType } from "@/lib/public-job";
import { errorResponse, paginationFromRequest } from "@/lib/server-utils";
import { isGarbageOrgName } from "@/lib/org-name";
import { createTtlCache } from "@/lib/ttl-cache";
import { eventLoopSnapshot, isPerfTraceEnabled, serverTimingHeader } from "@/lib/perf-trace";

type ListingJob = {
  id: string;
  title: string;
  location: string;
  employmentType: string;
  salaryRange: string | null;
  hiringCount: number;
  department: string | null;
  createdAt: Date;
  sourceUrl: string | null;
  descriptionExcerpt: string;
  company: { id: string; name: string; logoUrl: string | null };
  jobSkills: Array<{
    isRequired: boolean;
    skill: { id: string; name: string; category: string | null; type: string | null };
  }>;
};

type ListingPayload = {
  jobs: ListingJob[];
  total: number;
};

const listingCache = createTtlCache<ListingPayload>(80, 20_000);
const matchWarmCache = createTtlCache<true>(200, 60_000);
const inflight = new Map<string, Promise<ListingPayload>>();

async function loadPublishedJobs(input: {
  query: string;
  location: string;
  department: string;
  employmentType: string | null;
  skip: number;
  pageSize: number;
}): Promise<ListingPayload> {
  const where = {
    isPublished: true,
    archivedAt: null,
    company: { verificationStatus: "VERIFIED" as const },
    ...(input.query
      ? {
          OR: [
            { title: { contains: input.query } },
            { descriptionRaw: { contains: input.query } },
            { company: { name: { contains: input.query } } },
          ],
        }
      : {}),
    ...(input.location ? { location: { contains: input.location } } : {}),
    ...(input.department ? { department: { contains: input.department } } : {}),
    ...(input.employmentType ? { employmentType: input.employmentType } : {}),
  };
  const candidates = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, company: { select: { name: true } } },
  });
  const visibleIds = candidates
    .filter((job) => !isGarbageOrgName(job.company.name))
    .map((job) => job.id);
  const pageIds = visibleIds.slice(input.skip, input.skip + input.pageSize);
  if (pageIds.length === 0) return { total: visibleIds.length, jobs: [] };

  const pageRows = await prisma.job.findMany({
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
      company: { select: { id: true, name: true, logoUrl: true } },
      jobSkills: {
        include: { skill: { select: { id: true, name: true, category: true, type: true } } },
      },
    },
  });
  const jobs = pageIds.flatMap((id) => {
    const job = pageRows.find((row) => row.id === id);
    return job ? [job] : [];
  });
  const total = visibleIds.length;
  return {
    total,
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      location: job.location,
      employmentType: job.employmentType,
      salaryRange: job.salaryRange,
      hiringCount: job.hiringCount,
      department: job.department,
      createdAt: job.createdAt,
      sourceUrl: job.sourceUrl,
      descriptionExcerpt: excerptJobText(job.descriptionRaw),
      company: job.company,
      jobSkills: job.jobSkills,
    })),
  };
}

function listingKey(input: {
  query: string;
  location: string;
  department: string;
  employmentType: string | null;
  page: number;
  pageSize: number;
}) {
  return `${input.query}|${input.location}|${input.department}|${input.employmentType ?? ""}|${input.page}|${input.pageSize}`;
}

async function getListing(input: {
  query: string;
  location: string;
  department: string;
  employmentType: string | null;
  page: number;
  pageSize: number;
  skip: number;
}) {
  const key = listingKey(input);
  const cached = listingCache.get(key);
  if (cached) return { listing: cached, cache: "hit" as const };
  const running = inflight.get(key);
  if (running) {
    return { listing: await running, cache: "inflight" as const };
  }
  const next = loadPublishedJobs(input)
    .then((payload) => {
      listingCache.set(key, payload);
      return payload;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, next);
  return { listing: await next, cache: "miss" as const };
}

function toPublicJobCard(job: ListingJob, match?: ReturnType<typeof mapStoredMatch>) {
  return {
    id: job.id,
    companyName: job.company.name,
    companyLogoUrl: job.company.logoUrl ?? undefined,
    title: job.title,
    location: job.location,
    employmentType: toPublicEmploymentType(job.employmentType),
    salaryRange: job.salaryRange ?? undefined,
    hiringCount: job.hiringCount,
    department: job.department ?? undefined,
    postedAt: job.createdAt.toISOString(),
    sourceUrl: job.sourceUrl ?? `/jobs?jobId=${encodeURIComponent(job.id)}`,
    descriptionHtml: job.descriptionExcerpt,
    requiredSkills: job.jobSkills.filter((item) => item.isRequired).map((item) => item.skill),
    niceToHaveSkills: job.jobSkills.filter((item) => !item.isRequired).map((item) => item.skill),
    matchScorecard: match,
  };
}

export async function GET(request: NextRequest) {
  const t0 = performance.now();
  const user = await getSessionUser();
  const tSession = performance.now();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const location = (url.searchParams.get("location") ?? "").trim();
  const department = (url.searchParams.get("department") ?? "").trim();
  const employmentType = url.searchParams.get("employmentType");
  const { page, pageSize, skip } = paginationFromRequest(request, { pageSize: 30 });
  try {
    const { listing, cache } = await getListing({
      query,
      location,
      department,
      employmentType,
      page,
      pageSize,
      skip,
    });
    const tListing = performance.now();
    const visibleJobs = listing.jobs;
    const storedMatches =
      user?.role === "CANDIDATE" && visibleJobs.length > 0
        ? await prisma.jobMatch.findMany({
            where: { userId: user.userId, jobId: { in: visibleJobs.map((job) => job.id) } },
            select: { jobId: true, overallScore: true, matchSummaryJson: true },
          })
        : [];
    const tMatch = performance.now();
    const matchByJob = new Map(storedMatches.map((row) => [row.jobId, row]));
    if (user?.role === "CANDIDATE" && !matchWarmCache.get(user.userId)) {
      const missing = visibleJobs
        .filter((job) => !matchByJob.has(job.id))
        .slice(0, 6)
        .map((job) => job.id);
      if (missing.length > 0) {
        matchWarmCache.set(user.userId, true);
        after(() =>
          Promise.allSettled(
            missing.map((jobId) => persistJobMatch({ userId: user.userId, jobId })),
          ),
        );
      }
    }
    const mapped = visibleJobs.map((job) =>
      toPublicJobCard(job, mapStoredMatch(matchByJob.get(job.id))),
    );
    const tMap = performance.now();
    const loop = eventLoopSnapshot();
    const response = NextResponse.json({
      success: true,
      jobs: mapped,
      page,
      pageSize,
      total: listing.total,
      totalPages: Math.ceil(listing.total / pageSize),
      matching: user?.role === "CANDIDATE",
    });
    if (isPerfTraceEnabled()) {
      response.headers.set("x-perf-cache", cache);
      response.headers.set(
        "Server-Timing",
        serverTimingHeader({
          session: tSession - t0,
          listing: tListing - tSession,
          match: tMatch - tListing,
          map: tMap - tMatch,
          loopMean: loop.meanMs,
          loopMax: loop.maxMs,
          handler: performance.now() - t0,
        }),
      );
    }
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : error;
    console.error("[Jobs GET] Database error:", message);
    return errorResponse("Không thể tải danh sách việc làm.", 503);
  }
}
