export const ADAPTIVE_FALLBACK_PROVIDER = "adaptive-fallback-v1";

export type AdaptiveTurnInput = {
  jobTitle: string;
  jobDescription?: string | null;
  resumeText?: string | null;
  currentQuestion: {
    id: string;
    prompt: string;
    category?: string | null;
    orderIndex: number;
  };
  candidateSpeechText: string;
  priorTurns?: Array<{
    questionPrompt: string;
    candidateSpeech: string;
  }>;
  nextSlot?: {
    id: string;
    prompt: string;
    category?: string | null;
    orderIndex: number;
  } | null;
  language?: "vi" | "en";
};

export type AdaptiveTurnResult = {
  replyAudioText: string;
  nextPrompt: string;
  category: string;
  provider: string;
};

const TECH_PATTERN =
  /\b(react|next\.?js|vue|angular|node\.?js|nestjs|express|typescript|javascript|python|django|fastapi|golang|go|rust|java|spring|c#|\.net|docker|kubernetes|k8s|redis|kafka|rabbitmq|postgresql|postgres|mysql|mongodb|graphql|rest api|microservices|aws|gcp|azure|ci\/cd|git)\b/i;
const METRIC_PATTERN =
  /(\d+%\s*|\d+\s*(?:ms|giây|phút|giờ|người dùng|users|rps|qps|lần|triệu|tỷ|usd|vnd|đô|seconds|minutes|hours)|tăng trưởng|giảm thiểu|tiết kiệm|growth|reduced|improved)/i;

function cleanInline(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function sanitizePromptCopy(prompt: string, language?: "vi" | "en" | string): string {
  const en = language === "en" || language === "en-US";
  return prompt
    .replace(
      /\bSTAR\b/g,
      en ? "situation, task, action, result" : "tình huống, việc cần làm, hành động, kết quả",
    )
    .replace(/\bJD\b/g, en ? "job listing" : "tin tuyển dụng")
    .replace(/\bATS\b/g, en ? "recruiter screening software" : "phần mềm lọc hồ sơ");
}

/**
 * Deterministic local fallback generator.
 * Tuyệt đối không phụ thuộc mạng hay external LLM.
 * Phân tích đặc tính câu trả lời:
 * - Vague / Short answer -> STAR probe
 * - Technology mention -> Trade-offs & failure modes
 * - Metric / Result mention -> Validation & optimization methodology
 * - Thorough answer -> Collaboration & technical trade-offs
 */
export function generateLocalAdaptiveFallback(input: AdaptiveTurnInput): AdaptiveTurnResult {
  const isEn = input.language === "en";
  const answer = cleanInline(input.candidateSpeechText);
  const words = answer.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const techMatch = answer.match(TECH_PATTERN);
  const metricMatch = answer.match(METRIC_PATTERN);

  // 1. Vague / Short answer: rất ít từ (< 8 từ) hoặc ngắn (< 16 từ) và không chứa công nghệ / số liệu cụ thể
  const isVague = wordCount < 8 || (wordCount < 16 && !techMatch && !metricMatch);
  if (isVague) {
    if (isEn) {
      return {
        replyAudioText:
          "Thank you. To better evaluate your hands-on experience, I would like to dive into a specific situation.",
        nextPrompt: sanitizePromptCopy(
          "Could you walk me through a specific project where you tackled this issue, highlighting your role, the key action you took, and the end result?",
          "en",
        ),
        category: "behavioral",
        provider: ADAPTIVE_FALLBACK_PROVIDER,
      };
    }
    return {
      replyAudioText:
        "Cảm ơn bạn. Để đánh giá rõ hơn kinh nghiệm thực tế, tôi muốn tìm hiểu một tình huống cụ thể.",
      nextPrompt: sanitizePromptCopy(
        "Bạn có thể chia sẻ một dự án thực tế cụ thể, nêu rõ vai trò của bạn, các bước hành động (Action) đã thực hiện và kết quả đạt được (Result) không?",
        "vi",
      ),
      category: "behavioral",
      provider: ADAPTIVE_FALLBACK_PROVIDER,
    };
  }

  // 2. Technology mention: đề cập công nghệ cụ thể
  if (techMatch) {
    const techName = techMatch[0].trim();
    if (isEn) {
      return {
        replyAudioText: `Thank you for explaining your approach using ${techName}.`,
        nextPrompt: sanitizePromptCopy(
          `When designing and deploying with ${techName}, what trade-offs in terms of performance, reliability, or scalability did you encounter, and how did you mitigate potential failures?`,
          "en",
        ),
        category: "technical",
        provider: ADAPTIVE_FALLBACK_PROVIDER,
      };
    }
    return {
      replyAudioText: `Cảm ơn bạn đã chia sẻ giải pháp kỹ thuật với ${techName}.`,
      nextPrompt: sanitizePromptCopy(
        `Khi áp dụng ${techName}, bạn đã cân nhắc những đánh đổi (trade-offs) nào về hiệu năng, độ ổn định hoặc khả năng mở rộng, và hệ thống sẽ xử lý ra sao nếu gặp sự cố quá tải?`,
        "vi",
      ),
      category: "technical",
      provider: ADAPTIVE_FALLBACK_PROVIDER,
    };
  }

  // 3. Metric / Quantifiable result mention
  if (metricMatch) {
    if (isEn) {
      return {
        replyAudioText: "Thank you. Those measurable outcomes are notable.",
        nextPrompt: sanitizePromptCopy(
          "What benchmarking tools or validation methods did you use to verify those metrics, and what would you optimize if the system needed to scale 5x?",
          "en",
        ),
        category: "system_design",
        provider: ADAPTIVE_FALLBACK_PROVIDER,
      };
    }
    return {
      replyAudioText: "Cảm ơn bạn. Các số liệu và kết quả đo lường bạn nêu rất đáng chú ý.",
      nextPrompt: sanitizePromptCopy(
        "Bạn đã dùng công cụ hoặc phương pháp kiểm thử nào để đo lường chính xác các chỉ số này, và nếu tải hệ thống tăng gấp 5 lần, điểm nghẽn (bottleneck) đầu tiên sẽ ở đâu?",
        "vi",
      ),
      category: "system_design",
      provider: ADAPTIVE_FALLBACK_PROVIDER,
    };
  }

  // 4. Default / Thorough answer: chuyển sang tình huống thực tế hoặc phối hợp đội ngũ
  const roleName = cleanInline(input.jobTitle || (isEn ? "this role" : "vị trí này"));
  if (isEn) {
    return {
      replyAudioText: "Thank you for the detailed breakdown.",
      nextPrompt: sanitizePromptCopy(
        `In your experience relevant to ${roleName}, when facing conflicting architectural priorities or tight deadlines, how do you decide which technical debts to accept and which to resolve immediately?`,
        "en",
      ),
      category: "culture_fit",
      provider: ADAPTIVE_FALLBACK_PROVIDER,
    };
  }
  return {
    replyAudioText: "Cảm ơn bạn đã chia sẻ chi tiết quan điểm của mình.",
    nextPrompt: sanitizePromptCopy(
      `Đối với ${roleName}, trong trường hợp gặp bất đồng về kiến trúc kỹ thuật giữa các thành viên hoặc tiến độ gấp, bạn ưu tiên giải quyết xung đột và kiểm soát nợ kỹ thuật (technical debt) như thế nào?`,
      "vi",
    ),
    category: "culture_fit",
    provider: ADAPTIVE_FALLBACK_PROVIDER,
  };
}
