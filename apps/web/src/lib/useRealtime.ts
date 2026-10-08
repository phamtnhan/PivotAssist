"use client";

import { useEffect, useRef } from "react";
import type { RealtimeEvent } from "@/lib/realtime-hub";
import { useUser } from "@/lib/useUser";

const EVENT_NAME = "pivotassist:realtime";

export function RealtimeBridge() {
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (isLoading || !user) return;
    let source: EventSource | null = null;
    let closed = false;
    let retry = 0;
    let timer: number | undefined;

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/realtime");
      source.onmessage = (message) => {
        retry = 0;
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          if (event.type === "ping" || event.type === "hello") return;
          window.dispatchEvent(new CustomEvent<RealtimeEvent>(EVENT_NAME, { detail: event }));
        } catch {
          /* ignore malformed frames */
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (closed) return;
        const wait = Math.min(16_000, 700 * 2 ** retry);
        retry += 1;
        timer = window.setTimeout(connect, wait);
      };
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && !source && !closed) connect();
    };
    document.addEventListener("visibilitychange", onVisible);
    connect();
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) window.clearTimeout(timer);
      source?.close();
    };
  }, [isLoading, user]);

  return null;
}

export function useRealtime(onEvent: (event: RealtimeEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const handler = (message: Event) => {
      const event = (message as CustomEvent<RealtimeEvent>).detail;
      if (event) onEventRef.current(event);
    };
    window.addEventListener(EVENT_NAME, handler as EventListener);
    return () => window.removeEventListener(EVENT_NAME, handler as EventListener);
  }, []);
}
