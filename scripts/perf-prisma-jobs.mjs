/**
 * Isolate Prisma/MySQL cost for the published-job listing (no Next.js).
 * Does not print secrets. Loads DATABASE_URL from apps/web env files.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv("apps/web/.env");
loadEnv("apps/web/.env.local");
loadEnv(".env");

if (!process.env.DATABASE_URL) {
  console.error(JSON.stringify({ error: "DATABASE_URL missing" }));
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { prisma } = require(path.join(root, "packages/db/dist/client.js"));

const where = { isPublished: true, archivedAt: null };
const selectFull = {
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
  jobSkills: { include: { skill: { select: { id: true, name: true, category: true, type: true } } } },
};
const selectLean = {
  id: true,
  title: true,
  location: true,
  employmentType: true,
  salaryRange: true,
  hiringCount: true,
  department: true,
  createdAt: true,
  sourceUrl: true,
  company: { select: { id: true, name: true, logoUrl: true } },
  jobSkills: { include: { skill: { select: { name: true } } } },
};

async function timed(label, fn) {
  const t0 = performance.now();
  const value = await fn();
  return { label, ms: performance.now() - t0, value };
}

function pct(times, p) {
  const sorted = [...times].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function sample(label, n, fn) {
  const times = [];
  for (let i = 0; i < n; i += 1) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  return { label, n, min: Math.min(...times), p50: pct(times, 50), p95: pct(times, 95), max: Math.max(...times), mean: times.reduce((a, b) => a + b, 0) / times.length };
}

const report = { generated_at: new Date().toISOString(), db_host_set: Boolean(process.env.DATABASE_URL) };

try {
  const count = await prisma.job.count({ where });
  const sizes = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS n, COALESCE(AVG(CHAR_LENGTH(descriptionRaw)),0) AS avg_chars, COALESCE(MAX(CHAR_LENGTH(descriptionRaw)),0) AS max_chars FROM Job WHERE isPublished = 1 AND archivedAt IS NULL",
  );
  report.job_count = count;
  report.description_stats = sizes;

  let explain;
  try {
    explain = await prisma.$queryRawUnsafe(
      "EXPLAIN SELECT id, title, descriptionRaw FROM Job WHERE isPublished = 1 AND archivedAt IS NULL ORDER BY createdAt DESC LIMIT 30",
    );
  } catch (error) {
    explain = { error: error instanceof Error ? error.message : String(error) };
  }
  report.explain = explain;

  await timed("warmup-full", () => prisma.job.findMany({ where, orderBy: { createdAt: "desc" }, take: 30, select: selectFull }));
  report.prisma = {
    full_with_description: await sample("full", 10, () => prisma.job.findMany({ where, orderBy: { createdAt: "desc" }, take: 30, select: selectFull })),
    lean_no_description: await sample("lean", 10, () => prisma.job.findMany({ where, orderBy: { createdAt: "desc" }, take: 30, select: selectLean })),
    count_only: await sample("count", 10, () => prisma.job.count({ where })),
    transaction_like_api: await sample("tx", 10, () => prisma.$transaction([
      prisma.job.findMany({ where, orderBy: { createdAt: "desc" }, take: 30, select: selectFull }),
      prisma.job.count({ where }),
    ])),
  };
} finally {
  await prisma.$disconnect();
}

console.log(JSON.stringify(report, (_key, value) => (typeof value === "bigint" ? Number(value) : value), 2));
