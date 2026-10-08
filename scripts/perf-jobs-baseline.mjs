/**
 * Repeatable GET /jobs + /api/jobs latency baseline (performance-profiler).
 * Usage: node scripts/perf-jobs-baseline.mjs [baseUrl] [samples]
 */
const base = process.argv[2] || "http://localhost:3000";
const samples = Math.max(5, Number(process.argv[3] || 15));

function pct(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function timed(path) {
  const started = performance.now();
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  const body = await res.arrayBuffer();
  const ms = performance.now() - started;
  return {
    status: res.status,
    bytes: body.byteLength,
    ms,
    cache: res.headers.get("x-perf-cache"),
    serverTiming: res.headers.get("server-timing"),
  };
}

function summarize(rows) {
  const ok = rows.filter((row) => row.status >= 200 && row.status < 400);
  const times = ok.map((row) => row.ms).sort((a, b) => a - b);
  return {
    n: rows.length,
    ok: ok.length,
    errors: rows.length - ok.length,
    min: times[0] ?? null,
    p50: pct(times, 50),
    p95: pct(times, 95),
    p99: pct(times, 99),
    max: times[times.length - 1] ?? null,
    mean: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    bytes: ok[0]?.bytes ?? null,
  };
}

const report = {
  generated_at: new Date().toISOString(),
  base,
  samples,
  warmups: 2,
  node: process.version,
  paths: {},
};

for (const path of ["/jobs", "/api/jobs"]) {
  const warmup = [];
  for (let i = 0; i < 2; i += 1) warmup.push(await timed(path));
  const rows = [];
  for (let i = 0; i < samples; i += 1) rows.push(await timed(path));
  report.paths[path] = {
    warmup,
    measured: summarize(rows),
    raw_ms: rows.map((row) => row.ms),
    cache: rows.map((row) => row.cache),
    serverTiming: rows.map((row) => row.serverTiming),
  };
}

console.log(JSON.stringify(report, null, 2));
