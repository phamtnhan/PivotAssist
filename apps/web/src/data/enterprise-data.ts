import type { ApplicationStatus } from "@pivotassist/contracts";

export interface EnterpriseRubricItem {
  label: string;
  weight: number;
  description: string;
}

export interface EnterpriseJob {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  salaryRange: string;
  openedAt: string;
  hiringCount: number;
  status: "open" | "paused" | "Đang tuyển" | "Tạm dừng";
  description: string[];
  requirements: string[];
  rubric: EnterpriseRubricItem[];
}

export interface EnterpriseApplication {
  id: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateRole: string;
  initials: string;
  experience: string;
  resumeName: string;
  submittedAt: string;
  status: ApplicationStatus;
  cvMatch?: number;
  cvSummary?: string;
  cvSkills?: string[];
  interviewScore?: number;
  interviewId?: string;
  interviewDuration?: string;
  interviewRecording?: { sharedAt: string; playbackUrl: string; filename: string };
  completedAt?: string;
  signal: string;
  nextAction: string;
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  AI_INTERVIEW_PENDING: "Chờ phỏng vấn AI",
  AI_INTERVIEW_IN_PROGRESS: "Đang phỏng vấn AI",
  AI_INTERVIEW_COMPLETED: "Đã phỏng vấn AI",
  HOLD: "Đang giữ hồ sơ",
  ADDITIONAL_ASSESSMENT: "Cần bổ sung",
  SHORTLISTED: "Đã chọn sơ loại",
  FACE_TO_FACE_SCHEDULED: "Phòng phỏng vấn",
  OFFER_PENDING: "Đang soạn đề nghị",
  HIRED: "Đã tuyển",
  REJECTED: "Không phù hợp",
  WITHDRAWN: "Đã rút hồ sơ",
};
