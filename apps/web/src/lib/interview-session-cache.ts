const PREFIX = "pivotassist:q:";

export function readPromptList(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as { questions?: unknown; firstQuestion?: unknown };
  const fromList = Array.isArray(record.questions)
    ? record.questions.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const first =
    typeof record.firstQuestion === "string" && record.firstQuestion.trim()
      ? record.firstQuestion
      : null;
  return [...new Set(first ? [first, ...fromList] : fromList)];
}

export function stashInterviewPrompts(sessionId: string, prompts: string[], lang: string) {
  if (typeof window === "undefined" || !sessionId) return;
  const clean = [
    ...new Set(prompts.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean)),
  ];
  if (clean.length === 0) return;
  window.sessionStorage.setItem(
    PREFIX + sessionId,
    JSON.stringify({ prompts: clean, lang, at: Date.now() }),
  );
}

export function readStashedInterviewPrompts(sessionId: string): string[] {
  if (typeof window === "undefined" || !sessionId) return [];
  try {
    const raw = window.sessionStorage.getItem(PREFIX + sessionId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { prompts?: unknown };
    if (!Array.isArray(parsed.prompts)) return [];
    return parsed.prompts.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
  } catch {
    return [];
  }
}
