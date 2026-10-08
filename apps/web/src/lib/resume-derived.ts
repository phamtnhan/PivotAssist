export function resumeDerivedReplacePolicy(parsed: {
  extractedSkills?: string[] | null;
  experiences?: unknown[] | null;
  fullName?: string | null;
}) {
  const skills = Array.isArray(parsed.extractedSkills)
    ? parsed.extractedSkills.filter(Boolean)
    : [];
  const experiences = Array.isArray(parsed.experiences) ? parsed.experiences : [];
  return {
    replaceSkills: skills.length > 0,
    replaceExperiences: experiences.length > 0,
    updateFullName: Boolean(parsed.fullName?.trim()),
  };
}
