// REQ-0037 — untrusted resume/answers are data; scores clamped 0–100 (CANDIDATE-SEC-0010)
export type FreeRubricItem = {
  label: string;
  weight: number;
  description?: string;
};

export type ParsedResumeExperience = {
  role: string;
  company: string;
  period: string;
  bullets: string[];
};

export type ParsedResumeProfile = {
  fullName: string | null;
  currentJobTitle: string | null;
  yearsOfExperience: number;
  extractedSkills: string[];
  education: string[];
  summary: string;
  sections: Record<string, string>;
  email: string | null;
  phone: string | null;
  location: string | null;
  experiences: ParsedResumeExperience[];
};

export type FreeInterviewQuestion = {
  id: string;
  order: number;
  category: "behavioral" | "technical" | "system_design" | "domain" | "culture_fit";
  prompt: string;
  targetSkills: string[];
};

export type FreeInterviewEvaluation = {
  overallScore: number;
  starOverallScore: number;
  technicalScore: number;
  visualScore: number;
  strengths: string[];
  improvements: string[];
  feedback: Array<{
    targetSkill: string;
    reason: string;
    suggestedAction: string;
    severity: string;
  }>;
  questionScores: Array<{
    questionId: string;
    technicalScore: number;
    situationScore: number;
    taskScore: number;
    actionScore: number;
    resultScore: number;
    keyTakeaways: string[];
  }>;
  visualSummary: {
    overallScore: number;
    cameraGazeScore: number;
    headFramingScore: number;
    facialActivityScore: number;
    stabilityScore: number;
    videoQualityScore: number;
    totalBlinks: number;
    blinkFreqPerMin: number;
    gazeAwayCount: number;
    faceTouchCount: number;
    coachingSummary: string[];
  };
};

const SKILL_CATALOG = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "NestJS",
  "Express",
  "Python",
  "FastAPI",
  "Java",
  "Spring Boot",
  "C#",
  ".NET",
  "Go",
  "Rust",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "pgvector",
  "SQL",
  "GraphQL",
  "REST",
  "WebRTC",
  "LiveKit",
  "Docker",
  "Kubernetes",
  "AWS",
  "Cloudflare",
  "R2",
  "CI/CD",
  "Git",
  "GitHub Actions",
  "Tailwind CSS",
  "Figma",
  "Jest",
  "Playwright",
  "Cypress",
  "System Design",
  "Microservices",
  "Event-driven architecture",
  "Kafka",
  "RabbitMQ",
  "Machine Learning",
  "LLM",
  "LangGraph",
  "Prompt Engineering",
  "RAG",
  "Embeddings",
  "MediaPipe",
  "Computer Vision",
  "English",
  "Japanese",
  "Excel",
  "Word",
  "PowerPoint",
  "MISA",
  "ISO 9001",
  "GD&T",
  "5S",
  "Lean",
  "BOM",
  "SAP",
  "Accounting",
  "Tax",
  "Financial Reporting",
  "CRM",
  "Salesforce",
  "HubSpot",
  "Kinh doanh",
  "Sales",
  "Thương lượng",
  "Đàm phán",
  "Negotiation",
  "Quan hệ khách hàng",
  "Customer Success",
  "Phân tích dữ liệu",
  "Nghiên cứu thị trường",
  "Market research",
  "Leadership",
  "Quản trị kinh doanh",
  "Chăm sóc khách hàng",
  "Phân phối",
  "Đào tạo",
  // Software Engineering, Architecture & Programming
  "Lập trình",
  "Viết mã",
  "Phát triển phần mềm",
  "Kỹ thuật phần mềm",
  "Kiến trúc phần mềm",
  "Kiến trúc hệ thống",
  "Thiết kế hệ thống",
  "Mở rộng hệ thống",
  "Kiểm thử phần mềm",
  "Kiểm thử tự động",
  "Kiểm thử",
  "Gỡ lỗi",
  "Debugging",
  "Tối ưu hóa hiệu năng",
  "Performance Optimization",
  "Quản lý nhóm",
  "Quản lý dự án",
  "Team Management",
  "Project Management",
  "Tài liệu kỹ thuật",
  "Technical Documentation",
  "Hỗ trợ kỹ thuật",
  "Technical Support",
  "Giải thuật",
  "Cấu trúc dữ liệu",
  "Algorithms",
  "Data Structures",
  "HTML",
  "CSS",
  "Frontend",
  "Backend",
  "Fullstack",
  "DevOps",
  "Mobile App",
  "Android",
  "iOS",
];

const STOP_WORDS = new Set([
  "and",
  "the",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "you",
  "for",
  "are",
  "has",
  "have",
  "will",
  "can",
  "our",
  "not",
  "but",
  "cua",
  "cho",
  "cua",
  "mot",
  "nhung",
  "cac",
  "trong",
  "voi",
  "ban",
  "duoc",
  "lam",
  "tu",
  "va",
  "la",
  "co",
  "den",
  "theo",
  "moi",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function tokens(value: string): string[] {
  return unique(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function containsTerm(normalizedText: string, term: string, originalText?: string): boolean {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  if (normalizedTerm.length <= 3) {
    const source = (originalText ?? normalizedText).toLowerCase();
    const raw = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9+#./])${raw}(?:[^a-z0-9+#./]|$)`, "i").test(` ${source} `);
  }
  return normalizedText.includes(normalizedTerm);
}

export function extractSkills(text: string): string[] {
  const normalized = normalizeText(text);
  return SKILL_CATALOG.filter((skill) => containsTerm(normalized, skill, text));
}

function looksLikeNameToken(value: string): boolean {
  const trimmed = value.replace(/[|•].*$/, "").trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (
    /kỹ sư|engineer|developer|chuyên gia|tôi là|kinh nghiệm|năm|liên hệ|học vấn|thông tin/i.test(
      trimmed,
    )
  )
    return false;
  if (/@|\d|\./.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  return words.length >= 1 && words.length <= 4 && /^[\p{L}\s.'-]+$/u.test(trimmed);
}

function looksLikePersonName(value: string): boolean {
  const words = value.trim().split(/\s+/);
  return words.length >= 2 && words.length <= 6 && looksLikeNameToken(value);
}

function extractName(lines: string[], fullText: string): string | null {
  const header = lines.slice(0, 8);
  for (let index = 0; index < header.length; index += 1) {
    const current = header[index].replace(/[|•].*$/, "").trim();
    const next = header[index + 1]?.replace(/[|•].*$/, "").trim();
    if (next && looksLikeNameToken(current) && looksLikeNameToken(next)) {
      const joined = `${current} ${next}`.replace(/\s+/g, " ").trim();
      if (looksLikePersonName(joined)) return joined;
    }
    if (looksLikePersonName(current)) return current;
  }
  const collapsed = fullText.replace(/\s+/g, " ");
  const intro = collapsed.match(/tôi là\s+([^,]+)/i);
  if (intro?.[1]) {
    const name = intro[1].replace(/\s+/g, " ").trim();
    if (looksLikePersonName(name) && name.length <= 80) return name;
  }
  const explicit = textAfterLabel(lines, ["ho va ten", "họ và tên", "name"]);
  return explicit ?? null;
}

function textAfterLabel(lines: string[], labels: string[]): string | null {
  for (const line of lines) {
    const normalized = normalizeText(line);
    const label = labels.find((candidate) => normalized.startsWith(normalizeText(candidate)));
    if (!label) continue;
    const value = line
      .slice(line.toLowerCase().indexOf(label.toLowerCase()) + label.length)
      .replace(/^\s*[:|-]\s*/, "")
      .trim();
    if (value) return value;
  }
  return null;
}

function extractTitle(lines: string[], fullText: string): string | null {
  const labels = ["current role", "job title", "vi tri", "vị trí", "chuc danh", "chức danh"];
  const explicit = textAfterLabel(lines, labels);
  if (explicit) return explicit;
  const collapsed = fullText.replace(/\s+/g, " ");
  const fromIntro = collapsed.match(
    /(chuyên\s*gia|chuyên\s*viên(?:\s+kinh\s+doanh)?|trưởng\s*nhóm(?:\s+kinh\s+doanh)?|kỹ\s*sư(?:\s+phần\s+mềm)?|engineer(?:\s+\w+)?|developer(?:\s+\w+)?)/i,
  );
  if (fromIntro?.[1]) return fromIntro[1].replace(/\s+/g, " ").trim();
  const titleTerms = [
    "engineer",
    "developer",
    "designer",
    "manager",
    "accountant",
    "qa",
    "qc",
    "architect",
    "analyst",
    "kỹ sư",
    "kế toán",
    "chuyên viên",
    "chuyên gia",
    "trưởng nhóm",
    "giám đốc",
  ];
  return (
    lines
      .slice(0, 16)
      .find((line) => titleTerms.some((term) => normalizeText(line).includes(normalizeText(term))))
      ?.trim() ?? null
  );
}

function extractSections(lines: string[]): Record<string, string> {
  const sections: Record<string, string> = {};
  let current = "header";
  const headingRegex =
    /^(summary|profile|objective|experience|work experience|kinh nghiem|kinh nghiệm|kinh nghiệm làm việc|skills|technical skills|ky nang|kỹ năng|education|hoc van|học vấn|certifications|projects|du an|dự án|học vấn\s*&\s*chứng chỉ|kỹ năng chuyên môn|lĩnh vực chuyên môn|chuyên môn|năng lực|thông tin liên hệ|liên hệ)\s*:?(?:\s|$)/i;
  const mergedHeadingRegex =
    /(?:[,|\t]|\s{2,})(kinh\s+nghi[eệ]m(?:\s+l[aà]m\s+vi[eệ]c)?|h[oọ]c\s+v[aấ]n|k[yỹ]\s+n[aă]ng|chuy[eê]n\s+m[oô]n|l[iĩ]nh\s+v[uự]c\s+chuy[eê]n\s+m[oô]n)\s*:?\s*$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const directHeading = trimmed.match(headingRegex);
    if (directHeading) {
      current = normalizeText(directHeading[1] ?? trimmed).replace(/\s+/g, "_");
      sections[current] = sections[current] ? `${sections[current]}\n` : "";
      continue;
    }
    const mergedHeading = trimmed.match(mergedHeadingRegex);
    if (mergedHeading && mergedHeading.index !== undefined) {
      const priorText = trimmed
        .slice(0, mergedHeading.index)
        .replace(/[,|]\s*$/, "")
        .trim();
      if (priorText) {
        sections[current] = sections[current] ? `${sections[current]}\n${priorText}` : priorText;
      }
      current = normalizeText(mergedHeading[1]).replace(/\s+/g, "_");
      sections[current] = sections[current] ? `${sections[current]}\n` : "";
      continue;
    }
    sections[current] = sections[current] ? `${sections[current]}\n${trimmed}` : trimmed;
  }
  return sections;
}

function extractContact(text: string): {
  email: string | null;
  phone: string | null;
  location: string | null;
} {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phone =
    text.match(/(?:\+?84|0)[\s.]?\d{2,3}[\s.]?\d{3}[\s.]?\d{3,4}/)?.[0]?.replace(/\s+/g, "") ??
    null;
  const locationMatch = text.match(/địa chỉ\s*:\s*([^\n]+)/i);
  let location = locationMatch?.[1]?.trim() ?? null;
  if (!location) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const match = line.match(
        /(?:\d+[\w/.-]*\s+)?(?:đường|phố|quận|huyện|thị trấn|phường|tỉnh|thành phố|tp\.)\s+[A-Za-zÀ-ỹ0-9\s,.-]{3,80}/i,
      );
      if (match && !/^(kinh nghiệm|học vấn|kỹ năng)/i.test(line)) {
        location = match[0].replace(/[,|]\s*(kinh nghiệm|học vấn|kỹ năng).*$/i, "").trim();
        break;
      }
    }
  }
  return { email, phone, location };
}

function extractSkillPhrases(text: string, sections: Record<string, string>): string[] {
  const skillBlock =
    Object.entries(sections)
      .filter(([key]) => /skill|ky_nang|kỹ|nang/.test(key))
      .map(([, value]) => value)
      .join("\n") || text;
  const scored = [
    ...skillBlock.matchAll(/([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ0-9+.#/& ]{2,48}?)\s+(\d(?:\.\d)?)\s*\/\s*10/g),
  ]
    .map((match) => (match[1] ?? "").replace(/\s+/g, " ").trim())
    .filter(
      (name) =>
        name.length >= 3 &&
        name.length <= 48 &&
        !/^(kinh nghiem|hoc van|dia chi)$/i.test(normalizeText(name)),
    );
  return unique(scored).slice(0, 16);
}

function looksLikeRole(str: string): boolean {
  const trimmed = str.replace(/[|•].*$/, "").trim();
  if (!trimmed || trimmed.length > 80 || trimmed.length < 3) return false;
  if (/@|^https?:\/\/|^www\.|\.(vn|com|net|io|dev)$/i.test(trimmed)) return false;
  if (
    /^(học vấn|kỹ năng|địa chỉ|kinh nghiệm|thông tin|liên hệ|education|skills|experience|summary|lĩnh vực)/i.test(
      trimmed,
    )
  )
    return false;
  if (/(?:đường|phố|quận|huyện|thành phố|tp\.)\s+[A-Za-zÀ-ỹ]/i.test(trimmed)) return false;
  return (
    /kỹ sư|chuyên viên|chuyên gia|nhân viên|trưởng nhóm|trưởng phòng|quản lý|giám đốc|developer|engineer|manager|leader|designer|architect|intern|fresher|senior|junior|cao cấp|lead|analyst|specialist|consultant|officer|programmer|coder/i.test(
      trimmed,
    ) ||
    (/^[A-ZÀ-Ỹ][\p{L}\s/&-]+$/u.test(trimmed) && trimmed.split(/\s+/).length <= 6)
  );
}

function cleanCompany(str: string): string {
  let cleaned = str
    .replace(/^(?:https?:\/\/\S+|www\.\S+|[\w.-]+@[\w.-]+\.[a-z]{2,})\s+/i, "")
    .trim();
  cleaned = cleaned.replace(/^(?:linkedin\s*:?\s*|github\s*:?\s*|website\s*:?\s*)/i, "").trim();
  return cleaned;
}

function extractExperiences(lines: string[]): ParsedResumeExperience[] {
  const experiences: ParsedResumeExperience[] = [];
  const COMPANY_PREFIX =
    /(?:công ty|cong ty|cty|company|tập đoàn|tap doan|doanh nghiệp|doanh nghiep|corporation|corp|inc|llc|startup|studio|ngân hàng|ngan hang|bank|viện|vien)/i;
  const PERIOD_INDICATOR = /(?:tháng\s+\d|\d{1,2}\/\d{4}|\d{4}|hiện\s*tại|present|nay)/i;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const piped = line.match(/^(.{3,80}?)\s{2,}(.{3,80}?)\s*\|\s*(.+)$/);
    const companyLine = !piped
      ? line.match(
          /^(.{3,70}?)\s+((?:công ty|cong ty|cty|company|tập đoàn|tap doan)\s+.{2,60}?)\s*\|\s*(.+)$/i,
        )
      : null;
    const dated =
      !piped && !companyLine ? line.match(/^(.{3,80}?)\s*\|\s*(.{3,80}?)\s*\|\s*(\d{4}.+)$/) : null;

    let role = "";
    let company = "";
    let period = "";

    if (piped || companyLine || dated) {
      const match = (piped ?? companyLine ?? dated)!;
      role = match[1].replace(/\s+/g, " ").trim();
      company = cleanCompany(match[2].replace(/\s+/g, " ").trim());
      period = match[3].replace(/\s+/g, " ").trim();
    } else if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 2 && PERIOD_INDICATOR.test(parts[1])) {
        period = parts[1];
        const before = cleanCompany(parts[0]);
        if (COMPANY_PREFIX.test(before) || before.length >= 3) {
          company = before;
        }
      }
    }

    if (!company || !period) continue;

    if (
      !role ||
      /^www\.|^https?:\/\/|@|\.(vn|com|net|io|dev)$/i.test(role) ||
      /học vấn|kỹ năng|địa chỉ|xin chào/i.test(role)
    ) {
      for (let back = index - 1; back >= Math.max(0, index - 5); back -= 1) {
        const prev = lines[back]?.trim();
        if (!prev) continue;
        if (looksLikeRole(prev)) {
          role = prev;
          break;
        }
      }
    }

    if (
      !role ||
      /học vấn|kỹ năng|địa chỉ|xin chào/i.test(role) ||
      /^www\.|^https?:\/\/|\.(vn|com|net|io|dev)$/i.test(role)
    ) {
      continue;
    }

    const rawBullets: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor]?.trim();
      if (!next) continue;
      if (
        /\s\|\s/.test(next) ||
        /^(kinh nghiệm|học vấn|kỹ năng|education|experience|skills)/i.test(next)
      )
        break;
      if (COMPANY_PREFIX.test(next) && next.includes("|")) break;
      if (looksLikeRole(next) && lines[cursor + 1]?.includes("|")) break;

      const cleanedBullet = next
        .replace(/^(?:linkedin\s*:?\s*|github\s*:?\s*|website\s*:?\s*)/i, "")
        .replace(/https?:\/\/\S+|www\.\S+/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanedBullet.length >= 2) {
        rawBullets.push(cleanedBullet);
      }
      if (rawBullets.length >= 8) break;
    }

    const stitchedBullets: string[] = [];
    for (let b = 0; b < rawBullets.length; b += 1) {
      const cur = rawBullets[b];
      if (!cur) continue;
      if (stitchedBullets.length > 0 && (cur.length < 25 || /^[\p{Ll}\d,;.-]/u.test(cur))) {
        stitchedBullets[stitchedBullets.length - 1] =
          `${stitchedBullets[stitchedBullets.length - 1]} ${cur}`.replace(/\s+/g, " ").trim();
      } else {
        stitchedBullets.push(cur);
      }
    }

    experiences.push({ role, company, period, bullets: stitchedBullets.slice(0, 6) });
  }
  return experiences.slice(0, 8);
}

function inferYearsFromRanges(text: string): number {
  const ranges = [...text.matchAll(/(20\d{2})\s*[-–—]\s*(20\d{2}|hiện tại|present)/gi)];
  if (ranges.length === 0) return 0;
  const currentYear = new Date().getFullYear();
  let total = 0;
  for (const match of ranges) {
    const start = Number(match[1]);
    const endRaw = match[2];
    const end = /hiện tại|present/i.test(endRaw) ? currentYear : Number(endRaw);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 40)
      total += end - start;
  }
  return clamp(total, 0, 50);
}

export function parseResumeText(text: string, _filename = "resume.txt"): ParsedResumeProfile {
  const normalizedText = text.trim();
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const years = [...normalizedText.matchAll(/(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:năm|years?)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value <= 50);
  const sections = extractSections(lines);
  const education = lines
    .filter((line) =>
      /đại học|cao đẳng|university|college|gpa|bachelor|master|thạc sĩ|chứng chỉ|certificate/i.test(
        line,
      ),
    )
    .slice(0, 8);
  const contact = extractContact(normalizedText);
  const experiences = extractExperiences(lines);
  const catalogSkills = extractSkills(normalizedText);
  const phraseSkills = extractSkillPhrases(normalizedText, sections);
  const summary =
    sections.summary ?? sections.profile ?? sections.objective ?? lines.slice(0, 6).join(" ");
  const statedYears = years.length > 0 ? clamp(Math.max(...years), 0, 50) : 0;
  return {
    fullName: extractName(lines, normalizedText),
    currentJobTitle: extractTitle(lines, normalizedText),
    yearsOfExperience: statedYears || inferYearsFromRanges(normalizedText),
    extractedSkills: unique([...catalogSkills, ...phraseSkills]).slice(0, 24),
    education,
    summary,
    sections,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    experiences,
  };
}

export type JobMatchResult = {
  overallScore: number;
  technicalScore: number;
  experienceScore: number;
  domainScore: number;
  softSkillsScore: number;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingNiceToHaveSkills: string[];
  atsCompatibilityScore: number;
  atsMissingKeywords: string[];
};

export function matchResumeToJob(input: {
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  requiredSkills?: string[];
  niceToHaveSkills?: string[];
}): JobMatchResult {
  const resumeNormalized = normalizeText(input.resumeText);
  const jobNormalized = normalizeText(`${input.jobTitle} ${input.jobDescription}`);
  const required = unique([
    ...(input.requiredSkills ?? []),
    ...extractSkills(`${input.jobTitle} ${input.jobDescription}`),
  ]);
  const niceToHave = unique(input.niceToHaveSkills ?? []).filter(
    (skill) => !required.includes(skill),
  );
  const matchedRequired = required.filter((skill) =>
    containsTerm(resumeNormalized, skill, input.resumeText),
  );
  const matchedOptional = niceToHave.filter((skill) =>
    containsTerm(resumeNormalized, skill, input.resumeText),
  );
  const jobTokens = tokens(jobNormalized);
  const resumeTokens = new Set(tokens(resumeNormalized));
  const keywordHits = jobTokens.filter((token) => resumeTokens.has(token)).length;
  const keywordScore = jobTokens.length ? (keywordHits / Math.min(jobTokens.length, 80)) * 100 : 50;
  const requiredScore = required.length
    ? (matchedRequired.length / required.length) * 100
    : keywordScore;
  const years = parseResumeText(input.resumeText).yearsOfExperience;
  const experienceScore = clamp(50 + Math.min(years, 10) * 5);
  const technicalScore = clamp(requiredScore * 0.7 + keywordScore * 0.3);
  const domainScore = clamp(keywordScore * 0.8 + matchedOptional.length * 5);
  const softSkillsScore = clamp(
    65 +
      (containsTerm(resumeNormalized, "leadership") || containsTerm(resumeNormalized, "giao tiep")
        ? 20
        : 0),
  );
  const atsScore = clamp(requiredScore * 0.65 + keywordScore * 0.35);
  const overallScore = clamp(
    technicalScore * 0.35 + experienceScore * 0.25 + domainScore * 0.2 + softSkillsScore * 0.2,
  );
  return {
    overallScore,
    technicalScore,
    experienceScore,
    domainScore,
    softSkillsScore,
    matchedSkills: unique([...matchedRequired, ...matchedOptional]),
    missingRequiredSkills: required
      .filter((skill) => !matchedRequired.includes(skill))
      .slice(0, 12),
    missingNiceToHaveSkills: niceToHave
      .filter((skill) => !matchedOptional.includes(skill))
      .slice(0, 12),
    atsCompatibilityScore: atsScore,
    atsMissingKeywords: required
      .filter((skill) => !containsTerm(resumeNormalized, skill, input.resumeText))
      .slice(0, 12),
  };
}

export function generateInterviewQuestions(input: {
  jobTitle: string;
  jobDescription: string;
  resumeText?: string;
  configuredQuestions?: string[];
  limit?: number;
}): FreeInterviewQuestion[] {
  const parsed = parseResumeText(input.resumeText ?? "");
  const skills = unique([
    ...extractSkills(`${input.jobTitle}\n${input.jobDescription}\n${input.resumeText ?? ""}`),
    ...parsed.extractedSkills,
  ]);
  const configured = (input.configuredQuestions ?? []).filter(Boolean).slice(0, input.limit ?? 8);
  const firstExperience = parsed.experiences[0];
  const who = parsed.fullName
    ? `${parsed.fullName}${parsed.currentJobTitle ? ` (${parsed.currentJobTitle})` : ""}`
    : "bạn";
  const prompts =
    configured.length > 0
      ? configured
      : [
          `Dựa trên CV của ${who}, hãy giới thiệu kinh nghiệm phù hợp nhất với vị trí ${input.jobTitle}.`,
          firstExperience
            ? `CV ghi nhận vai trò ${firstExperience.role} tại ${firstExperience.company} (${firstExperience.period}). Hãy kể một tình huống khó — việc cần làm, hành động và kết quả — từ giai đoạn này.`
            : `Hãy kể một tình huống thực tế khi bạn giải quyết một vấn đề khó: việc cần làm, hành động và kết quả.`,
          `Bạn sẽ triển khai công việc ${input.jobTitle} như thế nào, gắn với các kỹ năng trên CV: ${skills.slice(0, 4).join(", ") || "các năng lực đã nêu"}?`,
          `Hãy mô tả cách bạn đo lường chất lượng và kết quả sau khi bàn giao, có đối chiếu số liệu nếu CV đã đề cập.`,
          `Khi có bất đồng với đồng nghiệp hoặc stakeholder, bạn sẽ xử lý và đưa ra quyết định ra sao?`,
          `Trong các kỹ năng ${skills.slice(0, 3).join(", ") || "trên CV và tin tuyển dụng"}, kỹ năng nào bạn mạnh nhất? Hãy đưa ví dụ cụ thể từ hồ sơ.`,
        ].slice(0, input.limit ?? 8);
  return prompts.map((prompt, index) => ({
    id: `free-q-${index + 1}`,
    order: index + 1,
    category:
      index === 0 || index === 4 ? "behavioral" : index === 2 ? "system_design" : "technical",
    prompt,
    targetSkills: skills.slice(
      index % Math.max(1, skills.length),
      (index % Math.max(1, skills.length)) + 4,
    ),
  }));
}

function answerForQuestion(
  questionId: string,
  transcripts: Array<{ questionId?: string | null; speaker: string; text: string }>,
): string {
  const direct = transcripts
    .filter((item) => item.speaker === "candidate" && item.questionId === questionId)
    .map((item) => item.text)
    .join(" ");
  if (direct) return direct;
  return transcripts
    .filter((item) => item.speaker === "candidate" && !item.questionId)
    .map((item) => item.text)
    .join(" ");
}

function scoreStar(answer: string): [number, number, number, number] {
  const normalized = normalizeText(answer);
  const lengthScore = clamp(answer.length / 4 + 35);
  const situation = clamp(
    lengthScore + (/(bối cảnh|tinh huong|tình huống|situation|khi)/i.test(answer) ? 15 : 0),
  );
  const task = clamp(
    lengthScore + (/(mục tiêu|nhiem vu|nhiệm vụ|task|responsib)/i.test(answer) ? 18 : 0),
  );
  const action = clamp(
    lengthScore +
      (/(toi da|tôi đã|thuc hien|thực hiện|action|giai phap|giải pháp|xây dựng|designed|implemented)/i.test(
        answer,
      )
        ? 20
        : 0),
  );
  const result = clamp(
    lengthScore +
      (/(kết quả|ket qua|result|giảm|tăng|saved|improv|%|số liệu)/i.test(answer) ? 22 : 0),
  );
  if (!normalized) return [35, 35, 35, 30];
  return [situation, task, action, result];
}

function scoreEmployerRubric(
  rubric: FreeRubricItem[] | undefined,
  candidateText: string,
): { score: number; missing: string[] } {
  const items = (rubric ?? [])
    .filter((item) => item && typeof item.label === "string" && item.label.trim())
    .slice(0, 12);
  if (items.length === 0) return { score: 0, missing: [] };
  const normalizedCandidate = normalizeText(candidateText);
  let weighted = 0;
  let totalWeight = 0;
  const missing: string[] = [];
  for (const item of items) {
    const weight = Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1;
    const source = `${item.label} ${item.description ?? ""}`;
    const terms = unique([
      ...extractSkills(source),
      ...tokens(source).filter((token) => token.length >= 4),
    ]).slice(0, 12);
    const matched = terms.filter((term) =>
      containsTerm(normalizedCandidate, term, candidateText),
    ).length;
    const hasEvidence =
      /\d|%|measured|metric|result|kết quả|đo lường|triển khai|implemented|designed/i.test(
        candidateText,
      );
    const itemScore = clamp(25 + Math.min(60, matched * 15) + (hasEvidence ? 15 : 0));
    weighted += itemScore * weight;
    totalWeight += weight;
    if (matched === 0) missing.push(item.label.trim());
  }
  return { score: totalWeight > 0 ? weighted / totalWeight : 0, missing };
}

export function evaluateInterview(input: {
  jobTitle: string;
  jobDescription: string;
  resumeText?: string;
  rubric?: FreeRubricItem[];
  questions: Array<{ id: string; prompt: string; category?: string }>;
  transcripts: Array<{ questionId?: string | null; speaker: string; text: string }>;
  visualEvents?: Array<{ type?: string; severity?: string }>;
}): FreeInterviewEvaluation {
  const jobTerms = extractSkills(`${input.jobTitle}\n${input.jobDescription}`);
  const allCandidateText = input.transcripts
    .filter((item) => item.speaker === "candidate")
    .map((item) => item.text)
    .join(" ");
  const jobNormalized = normalizeText(`${input.jobTitle} ${input.jobDescription}`);
  const rubricTerms = (input.rubric ?? []).flatMap((item) =>
    extractSkills(`${item.label} ${item.description ?? ""}`),
  );
  const resumeTerms = extractSkills(input.resumeText ?? "");
  const questionScores = input.questions.map((question) => {
    const answer = answerForQuestion(question.id, input.transcripts);
    const normalizedAnswer = normalizeText(answer);
    const questionTerms = unique([...extractSkills(question.prompt), ...jobTerms, ...rubricTerms]);
    const matches = questionTerms.filter((term) =>
      containsTerm(normalizedAnswer, term, answer),
    ).length;
    const resumeMatches = resumeTerms.filter((term) =>
      containsTerm(normalizedAnswer, term, answer),
    ).length;
    const hasEvidence =
      /\d|%|metric|measured|result|kết quả|đo lường|trade[- ]?off|đánh đổi|failure|sự cố/i.test(
        answer,
      );
    const relevant = matches > 0 || resumeMatches > 0;
    const technicalScore =
      answer.trim().length < 10
        ? 15
        : clamp(
            32 +
              Math.min(36, matches * 8) +
              Math.min(12, resumeMatches * 4) +
              (hasEvidence ? 12 : 0) +
              (relevant ? 8 : -8),
          );
    const [situationScore, taskScore, actionScore, resultScore] = scoreStar(answer);
    const takeaways =
      answer.length > 180
        ? [
            "Câu trả lời có đủ ngữ cảnh để đối chiếu với yêu cầu của tin tuyển dụng.",
            matches > 0
              ? `Đã đề cập ${matches} từ khóa kỹ thuật liên quan.`
              : "Cần liên kết rõ hơn với từ khóa trong tin tuyển dụng.",
          ]
        : ["Câu trả lời còn ngắn; nên bổ sung bối cảnh, hành động và kết quả định lượng."];
    return {
      questionId: question.id,
      technicalScore,
      situationScore,
      taskScore,
      actionScore,
      resultScore,
      keyTakeaways: takeaways,
    };
  });
  const technicalScore = questionScores.length
    ? clamp(
        questionScores.reduce((sum, row) => sum + row.technicalScore, 0) / questionScores.length,
      )
    : 45;
  const starOverallScore = questionScores.length
    ? clamp(
        questionScores.reduce(
          (sum, row) =>
            sum + (row.situationScore + row.taskScore + row.actionScore + row.resultScore) / 4,
          0,
        ) / questionScores.length,
      )
    : 40;
  const visualScore = 0;
  const rubricResult = scoreEmployerRubric(input.rubric, allCandidateText);
  const overallScore =
    rubricResult.score > 0
      ? clamp(technicalScore * 0.45 + starOverallScore * 0.35 + rubricResult.score * 0.2)
      : clamp(technicalScore * 0.55 + starOverallScore * 0.45);
  const answerTokens = new Set(tokens(allCandidateText));
  const keywordCoverage = jobTerms.filter((term) => answerTokens.has(normalizeText(term))).length;
  const strengths = [
    overallScore >= 80
      ? "Cấu trúc trả lời phù hợp với yêu cầu vòng AI Interview."
      : "Đã hoàn thành phiên phỏng vấn và có dữ liệu để cải thiện.",
    keywordCoverage > 0
      ? `Đã kết nối câu trả lời với ${keywordCoverage} năng lực trong tin tuyển dụng.`
      : "Có nền tảng để tiếp tục luyện tập theo tin tuyển dụng.",
  ];
  const improvements = [
    starOverallScore < 75
      ? "Bổ sung đủ tình huống, việc cần làm, hành động và kết quả trong mỗi ví dụ."
      : "Tiếp tục thêm số liệu đo lường vào phần kết quả.",
    technicalScore < 75
      ? "Liên kết giải pháp kỹ thuật với đánh đổi, tác động và cách đo lường."
      : "Giải thích rõ hơn phần đánh đổi khi trình bày giải pháp.",
  ];
  const feedback = improvements.map((reason, index) => ({
    targetSkill: index === 0 ? "Kể chuyện có tình huống và kết quả" : "Lập luận kỹ thuật",
    reason,
    suggestedAction:
      index === 0
        ? "Luyện 3 câu chuyện có số liệu theo tình huống, việc cần làm, hành động, kết quả."
        : "Nêu đánh đổi và số đo trong câu trả lời kỹ thuật.",
    severity: "info",
  }));
  const visualSummary = {
    overallScore: 0,
    cameraGazeScore: 0,
    headFramingScore: 0,
    facialActivityScore: 0,
    stabilityScore: 0,
    videoQualityScore: 0,
    totalBlinks: 0,
    blinkFreqPerMin: 0,
    gazeAwayCount: 0,
    faceTouchCount: 0,
    coachingSummary: ["AI Interview không dùng camera — không chấm gaze/visual."],
  };
  void jobNormalized;
  void input.rubric;
  void input.visualEvents;
  return {
    overallScore,
    starOverallScore,
    technicalScore,
    visualScore,
    strengths,
    improvements,
    feedback,
    questionScores,
    visualSummary,
  };
}

export function rewriteBullet(input: {
  originalBullet: string;
  jobTitle: string;
  jobDescription: string;
}): {
  originalBullet: string;
  rewrittenBullet: string;
  reasoning: string;
  keywordsInjected: string[];
  formulaUsed: "XYZ_FORMULA";
} {
  const keywords = extractSkills(`${input.jobTitle}\n${input.jobDescription}`).slice(0, 3);
  const clean = input.originalBullet.trim().replace(/[.]$/, "");
  return {
    originalBullet: input.originalBullet,
    rewrittenBullet: `${clean}; áp dụng ${keywords.join(", ") || "năng lực phù hợp với tin tuyển dụng"} và đo lường bằng kết quả cụ thể để máy nhà tuyển dụng đọc được.`,
    reasoning:
      "Bản viết lại bổ sung hành động, từ khóa theo tin tuyển dụng và chỗ đặt số liệu; ứng viên cần xác nhận lại số liệu trước khi sử dụng.",
    keywordsInjected: keywords,
    formulaUsed: "XYZ_FORMULA",
  };
}
