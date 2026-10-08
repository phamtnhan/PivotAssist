export type SilenceDecision = "WAIT" | "COMMIT" | "RETRY";

/**
 * Voice-only interaction rules stay pure so browser timing and STT provider
 * differences can be tested without a microphone or a network call.
 */
export function isPromptEcho(transcript: string, prompt: string): boolean {
  const normTrans = transcript
    .toLowerCase()
    .replace(/[.,!?:;'"“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const normPrompt = prompt
    .toLowerCase()
    .replace(/[.,!?:;'"“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normTrans || !normPrompt) return false;
  if (normTrans === normPrompt) return true;
  // Echo detection: only flag if transcript is substantial (>= 14 chars) and matches the prompt.
  // Short keywords or phrases like "React" or "dự án" are normal speech, not prompt echoes.
  if (normTrans.length >= 14 && normPrompt.includes(normTrans)) return true;
  if (
    normPrompt.length >= 14 &&
    normTrans.includes(normPrompt.slice(0, Math.min(30, normPrompt.length)))
  )
    return true;
  return false;
}

export function shouldInterruptAssistantSpeech(input: {
  assistantSpeaking: boolean;
  transcript: string;
  prompt?: string;
}): boolean {
  if (!input.assistantSpeaking) return false;
  const clean = input.transcript.trim().replace(/\s+/g, " ");
  if (clean.length < 3) return false;
  if (input.prompt && isPromptEcho(clean, input.prompt)) return false;
  return true;
}

export function mergeSttDraft(previous: string, incoming: string): string {
  const next = incoming.replace(/\s+/g, " ").trim();
  const prev = previous.replace(/\s+/g, " ").trim();
  if (!next) return prev;
  if (!prev) return next;
  // SpeechRecognition sends a complete committed prefix plus a new interim
  // suffix. A correction can replace that prefix, so the latest transcript is
  // authoritative when it is not an extension of the previous draft.
  if (next === prev || next.startsWith(`${prev} `)) return next;
  if (prev.startsWith(`${next} `)) return prev;
  return next;
}

export function classifyCandidateSilence(input: {
  silenceMs: number;
  hasSpeech: boolean;
  draft: string;
}): SilenceDecision {
  const draft = input.draft.trim();
  if (!input.hasSpeech || !draft) return input.silenceMs >= 3_000 ? "RETRY" : "WAIT";
  if (input.silenceMs < 1_000) return "WAIT";
  return "COMMIT";
}

export function isLongAnswer(text: string, threshold = 900): boolean {
  return text.trim().length >= threshold;
}

export function createTtsPlaybackGuard(initialKeys: string[] = []) {
  const played = new Set(initialKeys.filter(Boolean));
  return {
    claim(key: string): boolean {
      const normalized = key.trim();
      if (!normalized || played.has(normalized)) return false;
      played.add(normalized);
      return true;
    },
    has(key: string): boolean {
      return played.has(key.trim());
    },
    size(): number {
      return played.size;
    },
  };
}
