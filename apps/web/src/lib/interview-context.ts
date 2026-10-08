type SessionResumeContext = {
  parsedText?: string;
  filename?: string;
  id?: string;
};

type SessionJobContext = {
  title?: string;
  description?: string;
};

type SessionRubricItem = {
  label: string;
  weight?: number;
  description?: string;
};

export function parseSessionContext(contextJson: unknown): {
  job?: SessionJobContext;
  resume?: SessionResumeContext | null;
  rubric?: SessionRubricItem[];
  language?: string;
  provider?: string;
} {
  if (!contextJson || typeof contextJson !== "object" || Array.isArray(contextJson)) return {};
  const record = contextJson as Record<string, unknown>;
  const job =
    record.job && typeof record.job === "object" && !Array.isArray(record.job)
      ? (record.job as SessionJobContext)
      : undefined;
  const resume =
    record.resume && typeof record.resume === "object" && !Array.isArray(record.resume)
      ? (record.resume as SessionResumeContext)
      : null;
  return {
    job,
    resume,
    rubric: Array.isArray(record.rubric)
      ? record.rubric.filter(
          (item): item is SessionRubricItem =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { label?: unknown }).label === "string",
        )
      : [],
    language: typeof record.language === "string" ? record.language : undefined,
    provider: typeof record.provider === "string" ? record.provider : undefined,
  };
}

export function resumeTextFromSession(input: {
  applicationResumeText?: string | null;
  contextJson?: unknown;
}): string {
  const fromApplication = input.applicationResumeText?.trim() ?? "";
  if (fromApplication) return fromApplication;
  return parseSessionContext(input.contextJson).resume?.parsedText?.trim() ?? "";
}
