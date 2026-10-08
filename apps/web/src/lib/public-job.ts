export function excerptJobText(text: string, max = 600) {
  const clean = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function toPublicEmploymentType(
  value: string,
): "FULL_TIME" | "PART_TIME" | "CONTRACT" | "REMOTE" {
  if (value === "REMOTE") return "REMOTE";
  if (value === "PART_TIME") return "PART_TIME";
  if (value === "CONTRACT") return "CONTRACT";
  return "FULL_TIME";
}

export function mapStoredMatch(
  stored: { overallScore: number; matchSummaryJson: unknown } | null | undefined,
) {
  if (!stored) return undefined;
  const summary =
    stored.matchSummaryJson &&
    typeof stored.matchSummaryJson === "object" &&
    !Array.isArray(stored.matchSummaryJson)
      ? (stored.matchSummaryJson as {
          matchedSkills?: string[];
          missingRequiredSkills?: string[];
          missingNiceToHaveSkills?: string[];
        })
      : null;
  return {
    overallScore: stored.overallScore,
    matchedSkills: summary?.matchedSkills ?? [],
    missingRequiredSkills: summary?.missingRequiredSkills ?? [],
    missingNiceToHaveSkills: summary?.missingNiceToHaveSkills ?? [],
  };
}
