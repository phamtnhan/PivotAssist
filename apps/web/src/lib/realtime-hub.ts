// REQ-0008 — process-local SSE hub; Redis pub/sub only when REDIS_URL is set
import { getRedis } from "@/lib/redis";

export type RealtimeEvent = {
  type: "hello" | "ping" | "notification" | "support" | "jobs" | "pipeline";
  at?: number;
};

type Listener = (event: RealtimeEvent) => void;
type Buffered = { names: string[]; event: RealtimeEvent; exp: number };
type RedisEnvelope = { names: string[]; event: RealtimeEvent };

const MAX_LISTENERS_PER_CHANNEL = 400;
const REPLAY_MS = 20_000;
const REPLAY_MAX = 40;
const REDIS_CHANNEL = "pa:rt";

class RealtimeHub {
  private channels = new Map<string, Set<Listener>>();
  private recent: Buffered[] = [];

  subscribe(names: string[], listener: Listener) {
    void ensureRedisSubscriber();
    for (const name of names) {
      let bucket = this.channels.get(name);
      if (!bucket) {
        bucket = new Set();
        this.channels.set(name, bucket);
      }
      if (bucket.size >= MAX_LISTENERS_PER_CHANNEL) {
        const oldest = bucket.values().next().value;
        if (oldest) bucket.delete(oldest);
      }
      bucket.add(listener);
    }
    const now = Date.now();
    this.recent = this.recent.filter((item) => item.exp > now);
    for (const item of this.recent) {
      if (!item.names.some((name) => names.includes(name))) continue;
      try {
        listener(item.event);
      } catch (error) {
        console.warn("[Realtime] replay", error instanceof Error ? error.message : error);
      }
    }
    return () => {
      for (const name of names) {
        const bucket = this.channels.get(name);
        if (!bucket) continue;
        bucket.delete(listener);
        if (bucket.size === 0) this.channels.delete(name);
      }
    };
  }

  publish(names: string[], event: RealtimeEvent, fromRedis = false) {
    const payload = { ...event, at: event.at ?? Date.now() };
    this.recent.push({ names, event: payload, exp: Date.now() + REPLAY_MS });
    if (this.recent.length > REPLAY_MAX) this.recent.splice(0, this.recent.length - REPLAY_MAX);
    for (const name of names) {
      const bucket = this.channels.get(name);
      if (!bucket) continue;
      for (const listener of bucket) {
        try {
          listener(payload);
        } catch (error) {
          console.warn("[Realtime] listener", error instanceof Error ? error.message : error);
        }
      }
    }
    if (!fromRedis) void publishRedis({ names, event: payload });
  }

  subscriberCount() {
    let total = 0;
    for (const bucket of this.channels.values()) total += bucket.size;
    return total;
  }
}

const globalForRealtime = globalThis as typeof globalThis & {
  __pivotRealtime?: RealtimeHub;
  __pivotRtSub?: { started?: Promise<void> };
};

export const realtimeHub = globalForRealtime.__pivotRealtime ?? new RealtimeHub();
if (!globalForRealtime.__pivotRealtime) globalForRealtime.__pivotRealtime = realtimeHub;

async function publishRedis(envelope: RedisEnvelope) {
  const redis = await getRedis().catch(() => null);
  if (!redis) return;
  try {
    await redis.publish(REDIS_CHANNEL, JSON.stringify(envelope));
  } catch (error) {
    console.warn("[Realtime] redis publish", error instanceof Error ? error.message : error);
  }
}

async function ensureRedisSubscriber() {
  const g = globalForRealtime;
  if (g.__pivotRtSub?.started) return g.__pivotRtSub.started;
  g.__pivotRtSub = {
    started: (async () => {
      const redis = await getRedis().catch(() => null);
      if (!redis) return;
      try {
        const sub = redis.duplicate();
        await sub.subscribe(REDIS_CHANNEL);
        sub.on("message", (_channel, message) => {
          try {
            const parsed = JSON.parse(message) as RedisEnvelope;
            if (!parsed?.event || !Array.isArray(parsed.names)) return;
            realtimeHub.publish(parsed.names, parsed.event, true);
          } catch {
            /* ignore malformed */
          }
        });
      } catch (error) {
        console.warn("[Realtime] redis subscribe", error instanceof Error ? error.message : error);
      }
    })(),
  };
  return g.__pivotRtSub.started;
}

export function publishToUser(userId: string, type: RealtimeEvent["type"]) {
  realtimeHub.publish([`user:${userId}`], { type });
}

export function publishToRole(role: string, type: RealtimeEvent["type"]) {
  realtimeHub.publish([`role:${role}`], { type });
}

export function publishJobsChanged() {
  realtimeHub.publish(["jobs"], { type: "jobs" });
}

export function publishPipelineChanged() {
  realtimeHub.publish(["role:RECRUITER", "role:ADMIN"], { type: "pipeline" });
}
