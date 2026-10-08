// RISK-0001 — LiveKit interview media (L3). Do not log GEMINI_API_KEY (REQ-0009).
import { InterviewVoiceAgent, type InterviewAgentTurnResponse } from "./agent.js";
import type { InterviewContext } from "./prompt-coordinator.js";
import { PrismaInterviewStateStore, PrismaInterviewTurnStore } from "./state-store.js";

async function main() {
  console.log("Starting PivotAssist LiveKit Realtime Voice Agent worker...");

  const defaultContext: InterviewContext = {
    candidateName: "Nguyễn Thành Nam",
    targetRole: "AI & Full-Stack Solutions Architect",
    difficulty: "senior" as const,
    sessionStartedAtMs: Date.now(),
    questions: [
      "Hãy giới thiệu bản thân và lý do muốn chuyển sang AI Solutions Architect?",
      "Làm thế nào để thiết kế pipeline Voice AI thời gian thực với latency < 800ms?",
      "Hãy thiết kế cơ chế lưu trữ và truy vấn Telemetry thời gian thực cho 10.000 buổi phỏng vấn đồng thời?",
    ],
  };

  let context: InterviewContext = defaultContext;
  if (process.env.INTERVIEW_CONTEXT_JSON) {
    try {
      context = JSON.parse(process.env.INTERVIEW_CONTEXT_JSON) as InterviewContext;
    } catch {
      console.warn("INTERVIEW_CONTEXT_JSON is invalid; using free sample context.");
    }
  }
  const durableStateStore = context.sessionId ? new PrismaInterviewStateStore() : undefined;
  const durableTurnStore = context.sessionId
    ? new PrismaInterviewTurnStore<InterviewAgentTurnResponse>()
    : undefined;
  const agent = new InterviewVoiceAgent(context, durableStateStore, durableTurnStore);
  await agent.start();

  process.on("SIGTERM", () => {
    agent.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("LiveKit Voice Agent startup error:", err);
});
