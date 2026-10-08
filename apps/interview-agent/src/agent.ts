import {
  PromptCoordinator,
  type InterviewContext,
  type InterviewStateStore,
} from "./prompt-coordinator.js";
import type { DurableTurnStore } from "./state-store.js";

export interface InterviewAgentTurnResponse {
  turnId: string;
  replyAudioText: string;
  nextQuestion: string | null;
  elapsedMs: number;
  mode: "ADAPTIVE" | "FALLBACK";
  state: ReturnType<PromptCoordinator["getState"]>;
}

export class InterviewVoiceAgent {
  private readonly coordinator: PromptCoordinator;
  private isRunning = false;

  private readonly context: InterviewContext;
  private readonly turnStore?: DurableTurnStore<InterviewAgentTurnResponse>;

  constructor(
    context: InterviewContext,
    stateStore?: InterviewStateStore,
    turnStore?: DurableTurnStore<InterviewAgentTurnResponse>,
  ) {
    this.context = context;
    this.turnStore = turnStore;
    this.coordinator = new PromptCoordinator(context, stateStore);
  }

  async start(): Promise<void> {
    await this.coordinator.restore();
    this.isRunning = true;
    console.log(
      "[InterviewVoiceAgent] Adaptive voice agent initialized with recoverable interview state.",
    );
  }

  async onCandidateSpeechTurn(candidateSpeechText: string): Promise<InterviewAgentTurnResponse> {
    if (!this.isRunning) throw new Error("Interview voice agent is not running");
    const elapsedMs = this.coordinator.getElapsedSessionMs();
    const turnId = this.coordinator.getNextTurnId();
    if (this.turnStore && this.context.sessionId) {
      const replay = await this.turnStore.load(this.context.sessionId, turnId);
      if (replay) return replay;
    }
    const result = await this.coordinator.onCandidateSpeechTurn(candidateSpeechText, elapsedMs);
    // The browser/LiveKit adapter owns exactly one playback call for the
    // committed nextQuestion. There is intentionally no fixed acknowledgement.
    const response: InterviewAgentTurnResponse = {
      turnId: result.turnId,
      replyAudioText: "",
      nextQuestion: result.pipeline.nextQuestion?.prompt ?? null,
      elapsedMs,
      mode: result.mode,
      state: this.coordinator.getState(),
    };
    if (this.turnStore && this.context.sessionId) {
      return this.turnStore.save(
        this.context.sessionId,
        result.turnId,
        `${this.context.sessionId}:${result.turnId}`,
        result.mode,
        response,
      );
    }
    return response;
  }

  stop(): void {
    this.isRunning = false;
    console.log("[InterviewVoiceAgent] Voice agent disconnected.");
  }
}
