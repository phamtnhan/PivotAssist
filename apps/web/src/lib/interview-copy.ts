export function sanitizeInterviewPrompt(prompt: string, language?: "vi" | "en" | string) {
  const en = language === "en" || language === "en-US";
  return prompt
    .replace(
      /\bSTAR\b/g,
      en ? "situation, task, action, result" : "tình huống, việc cần làm, hành động, kết quả",
    )
    .replace(/\bJD\b/g, en ? "job listing" : "tin tuyển dụng")
    .replace(/\bATS\b/g, en ? "recruiter screening software" : "phần mềm lọc hồ sơ");
}
