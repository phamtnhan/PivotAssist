import { monitorEventLoopDelay } from "node:perf_hooks";

const loopDelay = monitorEventLoopDelay({ resolution: 20 });

export function isPerfTraceEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.PERF_TRACE === "1";
}

if (isPerfTraceEnabled()) {
  loopDelay.enable();
}

export function eventLoopSnapshot() {
  if (!isPerfTraceEnabled()) return { meanMs: 0, maxMs: 0 };
  const meanMs = loopDelay.mean / 1e6;
  const maxMs = loopDelay.max / 1e6;
  loopDelay.reset();
  return { meanMs, maxMs };
}

export function serverTimingHeader(parts: Record<string, number>) {
  return Object.entries(parts)
    .filter(([, dur]) => Number.isFinite(dur))
    .map(([name, dur]) => `${name};dur=${Number(dur).toFixed(1)}`)
    .join(", ");
}
