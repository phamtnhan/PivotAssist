import { getSessionUser } from "@/lib/auth";
import { realtimeHub, type RealtimeEvent } from "@/lib/realtime-hub";
import { errorResponse } from "@/lib/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để nhận cập nhật tức thì.", 401);

  const encoder = new TextEncoder();
  const channels = [`user:${user.userId}`, `role:${user.role}`, "jobs"];
  let cleanup = () => undefined as void;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = realtimeHub.subscribe(channels, send);
      const heartbeat = setInterval(() => send({ type: "ping" }), 25_000);
      send({ type: "hello" });
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      if (request.signal.aborted) {
        cleanup();
        return;
      }
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
