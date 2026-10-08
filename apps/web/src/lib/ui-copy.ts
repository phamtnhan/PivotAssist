export const APPLICATION_STATUS_VI: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  AI_INTERVIEW_PENDING: "Chờ phỏng vấn AI",
  AI_INTERVIEW_IN_PROGRESS: "Đang phỏng vấn AI",
  AI_INTERVIEW_COMPLETED: "Đã phỏng vấn AI",
  HOLD: "Đang giữ hồ sơ",
  ADDITIONAL_ASSESSMENT: "Cần bổ sung",
  SHORTLISTED: "Đã chọn sơ loại",
  FACE_TO_FACE_SCHEDULED: "Đã hẹn phòng phỏng vấn",
  OFFER_PENDING: "Đang soạn đề nghị",
  HIRED: "Đã nhận việc",
  REJECTED: "Không phù hợp",
  WITHDRAWN: "Đã rút hồ sơ",
};

export const APPLICATION_STATUS_EN: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  AI_INTERVIEW_PENDING: "Waiting for AI interview",
  AI_INTERVIEW_IN_PROGRESS: "AI interview in progress",
  AI_INTERVIEW_COMPLETED: "AI interview done",
  HOLD: "On hold",
  ADDITIONAL_ASSESSMENT: "More information needed",
  SHORTLISTED: "Selected for next round",
  FACE_TO_FACE_SCHEDULED: "Interview room booked",
  OFFER_PENDING: "Offer in progress",
  HIRED: "Hired",
  REJECTED: "Not a fit",
  WITHDRAWN: "Withdrawn",
};

export function applicationStatusLabel(status?: string | null, locale: "vi" | "en" = "vi") {
  const key = status ?? "";
  const table = locale === "en" ? APPLICATION_STATUS_EN : APPLICATION_STATUS_VI;
  return table[key] ?? key;
}

const APPLICATION_HELP_VI: Record<string, string> = {
  DRAFT: "Hồ sơ đang được chuẩn bị.",
  SUBMITTED: "Hồ sơ đã đến doanh nghiệp và đang chờ xử lý.",
  AI_INTERVIEW_PENDING: "Hoàn tất vòng phỏng vấn AI để hồ sơ được đánh giá theo tin tuyển dụng.",
  AI_INTERVIEW_IN_PROGRESS: "Phiên phỏng vấn AI đang được tiếp tục.",
  AI_INTERVIEW_COMPLETED: "Vòng 1 đã hoàn tất; doanh nghiệp đang xem xét hồ sơ.",
  HOLD: "Doanh nghiệp đang xem xét thêm hồ sơ của bạn.",
  ADDITIONAL_ASSESSMENT: "Doanh nghiệp cần bạn bổ sung thông tin hoặc làm thêm một vòng.",
  SHORTLISTED: "Bạn đã được chọn sơ loại cho vòng tiếp theo.",
  FACE_TO_FACE_SCHEDULED: "Doanh nghiệp đã mời bạn vào phòng phỏng vấn.",
  OFFER_PENDING: "Doanh nghiệp đang chuẩn bị đề nghị tuyển dụng.",
  HIRED: "Chúc mừng, hồ sơ đã được nhận.",
  REJECTED: "Hồ sơ đã khép lại ở vị trí này.",
  WITHDRAWN: "Bạn đã rút hồ sơ khỏi vị trí này.",
};

const APPLICATION_HELP_EN: Record<string, string> = {
  DRAFT: "This application is still being prepared.",
  SUBMITTED: "The employer has the application and is reviewing it.",
  AI_INTERVIEW_PENDING: "Finish the AI interview so this listing can be scored.",
  AI_INTERVIEW_IN_PROGRESS: "The AI interview is still in progress.",
  AI_INTERVIEW_COMPLETED: "Round 1 is done; the employer is reviewing the file.",
  HOLD: "The employer is still reviewing this file.",
  ADDITIONAL_ASSESSMENT: "The employer asked for more information or another round.",
  SHORTLISTED: "You were selected for the next round.",
  FACE_TO_FACE_SCHEDULED: "The employer invited you to an interview room.",
  OFFER_PENDING: "The employer is preparing an offer.",
  HIRED: "This application was accepted.",
  REJECTED: "This application is closed for this role.",
  WITHDRAWN: "You withdrew this application.",
};

const CANDIDATE_FACING_VI: Record<string, { label: string; help: string }> = {
  waiting_interview: {
    label: "Chờ phỏng vấn",
    help: "Hoàn tất vòng phỏng vấn để hồ sơ được xem xét.",
  },
  in_progress: { label: "Đang phỏng vấn", help: "Phiên phỏng vấn đang diễn ra." },
  completed: {
    label: "Đã hoàn thành phỏng vấn",
    help: "Bạn đã xong vòng phỏng vấn. Doanh nghiệp đang xem xét.",
  },
  under_review: { label: "Đang được xem xét", help: "Doanh nghiệp đang xem hồ sơ của bạn." },
  need_info: {
    label: "Cần bổ sung thông tin",
    help: "Doanh nghiệp cần thêm thông tin hoặc một vòng đánh giá nữa.",
  },
  next_interview: {
    label: "Được mời phỏng vấn vòng tiếp theo",
    help: "Bạn đã được mời sang vòng sau. Vào phòng phỏng vấn khi có lịch.",
  },
  offer_received: {
    label: "Nhận được đề nghị tuyển dụng",
    help: "Xem đề nghị và chọn chấp nhận hoặc từ chối.",
  },
  not_a_fit: { label: "Hồ sơ chưa phù hợp", help: "Hồ sơ đã khép lại ở vị trí này." },
  hired: { label: "Đã nhận việc", help: "Bạn đã chấp nhận đề nghị và được nhận vào vị trí này." },
  withdrawn: { label: "Đã rút hồ sơ", help: "Bạn đã rút hồ sơ khỏi vị trí này." },
};

const CANDIDATE_FACING_EN: Record<string, { label: string; help: string }> = {
  waiting_interview: {
    label: "Waiting for interview",
    help: "Finish the interview so this file can be reviewed.",
  },
  in_progress: { label: "Interview in progress", help: "The interview session is still open." },
  completed: {
    label: "Interview completed",
    help: "You finished the interview. The employer is reviewing it.",
  },
  under_review: { label: "Under review", help: "The employer is reviewing your file." },
  need_info: {
    label: "More information needed",
    help: "The employer asked for more information or another assessment.",
  },
  next_interview: {
    label: "Invited to the next interview",
    help: "You were invited to the next round. Join the room when a time is set.",
  },
  offer_received: { label: "Offer received", help: "Review the offer and accept or decline." },
  not_a_fit: { label: "Not a fit", help: "This application is closed for this role." },
  hired: { label: "Hired", help: "You accepted the offer for this role." },
  withdrawn: { label: "Withdrawn", help: "You withdrew this application." },
};

export function candidateFacingLabel(status?: string | null, locale: "vi" | "en" = "vi") {
  const table = locale === "en" ? CANDIDATE_FACING_EN : CANDIDATE_FACING_VI;
  return table[status ?? ""]?.label ?? applicationStatusLabel(status, locale);
}

export function candidateFacingHelp(status?: string | null, locale: "vi" | "en" = "vi") {
  const table = locale === "en" ? CANDIDATE_FACING_EN : CANDIDATE_FACING_VI;
  return table[status ?? ""]?.help ?? applicationStatusHelp(status, locale);
}

export function applicationStatusHelp(status?: string | null, locale: "vi" | "en" = "vi") {
  const key = status ?? "";
  const table = locale === "en" ? APPLICATION_HELP_EN : APPLICATION_HELP_VI;
  return table[key] ?? "";
}

export function employmentTypeVi(value?: string | null) {
  const raw = (value ?? "").toUpperCase();
  if (raw.includes("REMOTE") || raw.includes("TỪ XA")) return "Làm từ xa";
  if (raw.includes("HYBRID") || raw.includes("LINH HOẠT")) return "Kết hợp";
  if (raw.includes("PART")) return "Bán thời gian";
  if (raw.includes("CONTRACT")) return "Hợp đồng";
  if (raw.includes("FULL") || raw.includes("TOÀN")) return "Toàn thời gian";
  return value || "Toàn thời gian";
}

export function locationVi(value?: string | null) {
  return (value ?? "—")
    .replace(/\bHybrid\b/gi, "Kết hợp")
    .replace(/\bRemote\b/gi, "Làm từ xa")
    .replace(/\bFull[- ]?time\b/gi, "Toàn thời gian");
}

export function employmentTypeLabel(value?: string | null, locale: "vi" | "en" = "vi") {
  const vi = employmentTypeVi(value);
  if (locale !== "en") return vi;
  if (vi === "Làm từ xa") return "Remote";
  if (vi === "Kết hợp") return "Flexible mix";
  if (vi === "Bán thời gian") return "Part time";
  if (vi === "Hợp đồng") return "Contract";
  if (vi === "Toàn thời gian") return "Full time";
  return value || "Full time";
}

export function locationLabel(value?: string | null, locale: "vi" | "en" = "vi") {
  if (locale !== "en") return locationVi(value);
  return (value ?? "—")
    .replace(/\bKết hợp\b/gi, "Flexible mix")
    .replace(/\bLàm từ xa\b/gi, "Remote")
    .replace(/\bToàn thời gian\b/gi, "Full time")
    .replace(/\bHybrid\b/gi, "Flexible mix");
}
