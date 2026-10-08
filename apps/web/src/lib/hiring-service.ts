// REQ-0002 — pipeline HIRED only after Offer.ACCEPTED in this service
// REQ-0038 — hiring SQL uses Prisma parameterized APIs (no string-concat $queryRaw)
import type { AuthUserPayload } from "@/lib/auth";
import { prisma } from "@/lib/auth";
import { createNotification, writeAuditLog } from "@/lib/server-utils";
import { accessibleApplicationWhere } from "@/lib/enterprise-server";
import type { HiringDecisionAction, OfferStatus } from "@pivotassist/contracts";
import {
  HiringConflictError,
  HiringForbiddenError,
  HiringInputError,
  HiringNotFoundError,
  canDecideFrom,
  canTransitionOffer,
  decisionIdempotencyKey,
  defaultRejectCandidateMessage,
  isMaterialOfferChange,
  materialHashForOffer,
  offerIsActive,
  offerIsPublicToCandidate,
  parsePipelineStatus,
  pipelineAfterDecision,
} from "@/lib/hiring-pipeline";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const ACTIVE_OFFER = ["DRAFT", "APPROVAL_PENDING", "APPROVED", "SENT"] as const;

function hiringErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return null;
}

export function rethrowHiringError(error: unknown): never {
  const status = hiringErrorStatus(error);
  if (status && error instanceof Error) throw error;
  throw error;
}

async function loadEnterpriseApplication(user: AuthUserPayload, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, ...accessibleApplicationWhere(user) },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          employmentType: true,
          location: true,
          companyId: true,
          company: { select: { id: true, name: true, members: { select: { userId: true } } } },
        },
      },
      user: { select: { id: true, fullName: true } },
      interviews: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          interviewScore: { select: { overallScore: true, evaluationStatus: true } },
        },
      },
      offers: { orderBy: { createdAt: "desc" }, take: 4 },
    },
  });
  if (!application)
    throw new HiringNotFoundError("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.");
  return application;
}

async function notify(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  dedupeKey: string;
}) {
  await createNotification(input);
}

export async function decideApplication(input: {
  user: AuthUserPayload;
  applicationId: string;
  action: HiringDecisionAction;
  internalReason?: string | null;
  candidateMessage?: string | null;
  idempotencyKey?: string | null;
  sessionId?: string | null;
}) {
  const application = await loadEnterpriseApplication(input.user, input.applicationId);
  const current = parsePipelineStatus(application.status);
  const scoredSession = application.interviews.find(
    (session) =>
      session.interviewScore?.evaluationStatus === "READY" &&
      typeof session.interviewScore.overallScore === "number",
  );
  const hasReadyEvaluation = Boolean(scoredSession);
  const activeOffer = application.offers.find((offer) => offerIsActive(offer.status));
  const gate = canDecideFrom(current, input.action, {
    hasReadyEvaluation,
    hasActiveOffer: Boolean(activeOffer),
    offerStatus: activeOffer?.status ?? null,
  });
  if (!gate.ok) throw new HiringConflictError(gate.reason);

  if (input.action === "REJECT" && current === "REJECTED") {
    return { application, already: true as const, action: input.action, toStatus: current };
  }
  if (input.action === "PROCEED_TO_OFFER" && activeOffer && current === "OFFER_PENDING") {
    return {
      application,
      already: true as const,
      action: input.action,
      toStatus: current,
      offer: activeOffer,
    };
  }

  const toStatus = pipelineAfterDecision(input.action);
  const candidateMessage =
    input.action === "REJECT"
      ? input.candidateMessage?.trim() || defaultRejectCandidateMessage(application.job.title)
      : input.candidateMessage?.trim() || null;
  const internalReason = input.internalReason?.trim() || null;
  if (input.action === "REJECT" && !internalReason) {
    throw new HiringInputError("Cần lý do nội bộ khi từ chối hồ sơ.");
  }

  const idempotencyKey =
    input.idempotencyKey?.trim() || decisionIdempotencyKey(input.action, application.version);

  const existingDecision = await prisma.applicationDecision.findUnique({
    where: { applicationId_idempotencyKey: { applicationId: application.id, idempotencyKey } },
  });
  if (existingDecision) {
    const refreshed = await loadEnterpriseApplication(input.user, application.id);
    return {
      application: refreshed,
      already: true as const,
      action: input.action,
      toStatus: existingDecision.toStatus,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const moved = await tx.application.updateMany({
        where: {
          id: application.id,
          version: application.version,
          status: {
            notIn: ["HIRED", "WITHDRAWN", ...(input.action === "REJECT" ? [] : ["REJECTED"])],
          },
        },
        data: {
          status: toStatus,
          version: { increment: 1 },
          candidateMessage,
          internalReason: internalReason ?? undefined,
          decisionAt: new Date(),
          decidedById: input.user.userId,
          shortlistedAt: input.action === "NEXT_INTERVIEW" ? new Date() : undefined,
        },
      });
      if (moved.count !== 1) {
        throw new HiringConflictError("Hồ sơ vừa được người khác cập nhật. Tải lại rồi thử lại.");
      }
      await tx.applicationDecision.create({
        data: {
          applicationId: application.id,
          actorId: input.user.userId,
          action: input.action,
          fromStatus: current,
          toStatus,
          sessionId: input.sessionId ?? scoredSession?.id ?? application.interviews[0]?.id ?? null,
          internalReason,
          candidateMessage,
          idempotencyKey,
        },
      });
      if (input.action === "PROCEED_TO_OFFER" && !activeOffer) {
        await createOfferInTx(tx, {
          user: input.user,
          application,
        });
      }
      if (
        input.action === "REJECT" &&
        activeOffer &&
        activeOffer.status !== "SENT" &&
        activeOffer.status !== "ACCEPTED"
      ) {
        await tx.offer.updateMany({
          where: { id: activeOffer.id, status: { in: ["DRAFT", "APPROVAL_PENDING", "APPROVED"] } },
          data: { status: "WITHDRAWN", withdrawnAt: new Date(), version: { increment: 1 } },
        });
      }
    });
  } catch (error) {
    if (error instanceof HiringConflictError) {
      const raced = await prisma.applicationDecision.findUnique({
        where: { applicationId_idempotencyKey: { applicationId: application.id, idempotencyKey } },
      });
      if (raced) {
        const refreshed = await loadEnterpriseApplication(input.user, application.id);
        return {
          application: refreshed,
          already: true as const,
          action: input.action,
          toStatus: raced.toStatus,
        };
      }
    }
    throw error;
  }

  const refreshed = await loadEnterpriseApplication(input.user, application.id);
  await writeAuditLog(input.user, "application.decision", application.id, {
    action: input.action,
    from: current,
    to: toStatus,
  });

  const href = "/applications";
  if (input.action === "REJECT") {
    await notify({
      userId: application.user.id,
      type: "application.rejected",
      title: "Hồ sơ chưa phù hợp",
      body: candidateMessage ?? defaultRejectCandidateMessage(application.job.title),
      href,
      dedupeKey: `application.rejected:${application.id}`,
    });
  } else if (input.action === "NEXT_INTERVIEW") {
    await notify({
      userId: application.user.id,
      type: "next_interview.requested",
      title: "Được mời phỏng vấn vòng tiếp theo",
      body: `Doanh nghiệp đã mời bạn sang vòng tiếp theo cho ${application.job.title}.`,
      href,
      dedupeKey: `next_interview.requested:${application.id}:v${application.version + 1}`,
    });
  } else if (input.action === "ADDITIONAL_ASSESSMENT") {
    await notify({
      userId: application.user.id,
      type: "application.need_info",
      title: "Cần bổ sung thông tin",
      body:
        candidateMessage || `Doanh nghiệp cần thêm thông tin cho vị trí ${application.job.title}.`,
      href,
      dedupeKey: `application.need_info:${application.id}:v${application.version + 1}`,
    });
  } else if (input.action === "HOLD") {
    await notify({
      userId: application.user.id,
      type: "application.hold",
      title: "Hồ sơ đang được xem xét",
      body: `Hồ sơ cho ${application.job.title} đang được doanh nghiệp xem xét.`,
      href,
      dedupeKey: `application.hold:${application.id}:v${application.version + 1}`,
    });
  } else if (input.action === "PROCEED_TO_OFFER") {
    await writeAuditLog(input.user, "offer.created", refreshed.offers[0]?.id ?? application.id, {
      applicationId: application.id,
    });
  }

  const { publishPipelineChanged, publishToUser } = await import("@/lib/realtime-hub");
  publishPipelineChanged();
  publishToUser(application.user.id, "notification");
  return { application: refreshed, already: false as const, action: input.action, toStatus };
}

async function createOfferInTx(
  tx: Tx,
  input: {
    user: AuthUserPayload;
    application: Awaited<ReturnType<typeof loadEnterpriseApplication>>;
  },
) {
  const title = input.application.job.title;
  const employmentType = input.application.job.employmentType || "FULL_TIME";
  const location = input.application.job.location || null;
  const hash = materialHashForOffer({
    title,
    employmentType,
    compensationAmount: 0,
    currency: "VND",
    startDate: null,
    location,
    benefits: null,
    terms: null,
  });
  return tx.offer.create({
    data: {
      applicationId: input.application.id,
      jobId: input.application.job.id,
      companyId: input.application.job.companyId,
      candidateUserId: input.application.user.id,
      createdById: input.user.userId,
      title,
      employmentType,
      compensationAmount: 0,
      currency: "VND",
      location,
      materialHash: hash,
      status: "DRAFT",
    },
  });
}

export async function upsertInterviewReview(input: {
  user: AuthUserPayload;
  applicationId: string;
  sessionId?: string | null;
  status: "DRAFT" | "SUBMITTED";
  overallRecommendation?: string | null;
  strengths?: string | null;
  concerns?: string | null;
  comment?: string | null;
  privateNote?: string | null;
  criteria?: Array<{ label: string; rating: number; comment?: string }>;
}) {
  const application = await loadEnterpriseApplication(input.user, input.applicationId);
  const reviewScopeKey = input.sessionId?.trim() || application.interviews[0]?.id || "application";
  if (input.sessionId) {
    const session = await prisma.interviewSession.findFirst({
      where: { id: input.sessionId, applicationId: application.id },
      select: { id: true },
    });
    if (!session) throw new HiringInputError("Phiên phỏng vấn không thuộc hồ sơ này.");
  }
  const existing = await prisma.interviewReview.findUnique({
    where: {
      applicationId_reviewerId_reviewScopeKey: {
        applicationId: application.id,
        reviewerId: input.user.userId,
        reviewScopeKey,
      },
    },
  });
  const data = {
    sessionId: input.sessionId ?? application.interviews[0]?.id ?? null,
    overallRecommendation: input.overallRecommendation ?? null,
    strengths: input.strengths ?? null,
    concerns: input.concerns ?? null,
    comment: input.comment ?? null,
    privateNote: input.privateNote ?? null,
    criteriaJson: input.criteria ?? undefined,
    status: input.status,
    submittedAt: input.status === "SUBMITTED" ? new Date() : (existing?.submittedAt ?? null),
  };
  const review = existing
    ? await prisma.interviewReview.update({ where: { id: existing.id }, data })
    : await prisma.interviewReview.create({
        data: {
          applicationId: application.id,
          reviewerId: input.user.userId,
          reviewScopeKey,
          ...data,
        },
      });
  await writeAuditLog(
    input.user,
    input.status === "SUBMITTED" ? "review.submitted" : "review.updated",
    review.id,
    {
      applicationId: application.id,
    },
  );
  return review;
}

export function serializeReviewForViewer(
  review: {
    id: string;
    reviewerId: string;
    status: string;
    overallRecommendation: string | null;
    strengths: string | null;
    concerns: string | null;
    comment: string | null;
    privateNote: string | null;
    criteriaJson: unknown;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    reviewer?: { id: string; fullName: string };
  },
  viewerId: string,
  viewerSubmitted: boolean,
) {
  const hideOthers =
    review.reviewerId !== viewerId && review.status === "SUBMITTED" && !viewerSubmitted;
  if (review.reviewerId !== viewerId && !viewerSubmitted && review.status !== "SUBMITTED") {
    return null;
  }
  if (hideOthers) {
    return {
      id: review.id,
      reviewerId: review.reviewerId,
      reviewerName: review.reviewer?.fullName ?? null,
      status: "SUBMITTED" as const,
      hiddenUntilYouSubmit: true,
    };
  }
  return {
    id: review.id,
    reviewerId: review.reviewerId,
    reviewerName: review.reviewer?.fullName ?? null,
    status: review.status,
    overallRecommendation: review.overallRecommendation,
    strengths: review.strengths,
    concerns: review.concerns,
    comment: review.comment,
    privateNote: review.reviewerId === viewerId ? review.privateNote : null,
    criteria: Array.isArray(review.criteriaJson) ? review.criteriaJson : [],
    submittedAt: review.submittedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    hiddenUntilYouSubmit: false,
  };
}

export async function listInterviewReviews(user: AuthUserPayload, applicationId: string) {
  await loadEnterpriseApplication(user, applicationId);
  const reviews = await prisma.interviewReview.findMany({
    where: { applicationId },
    include: { reviewer: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const viewerSubmitted = reviews.some(
    (review) => review.reviewerId === user.userId && review.status === "SUBMITTED",
  );
  return reviews
    .map((review) => serializeReviewForViewer(review, user.userId, viewerSubmitted))
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

async function loadEnterpriseOffer(user: AuthUserPayload, offerId: string) {
  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      application: accessibleApplicationWhere(user),
    },
    include: {
      application: {
        select: {
          id: true,
          status: true,
          version: true,
          userId: true,
          job: { select: { title: true } },
        },
      },
      approvals: {
        orderBy: { orderIndex: "asc" },
        include: { approver: { select: { id: true, fullName: true } } },
      },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!offer)
    throw new HiringNotFoundError(
      "Đề nghị tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.",
    );
  return offer;
}

function expireIfNeeded(offer: { id: string; status: OfferStatus; expiresAt: Date | null }) {
  if (offer.status === "SENT" && offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
    return true;
  }
  return false;
}

export async function updateOffer(input: {
  user: AuthUserPayload;
  offerId: string;
  title?: string;
  employmentType?: string;
  compensationAmount?: number;
  currency?: string;
  startDate?: string | null;
  location?: string | null;
  benefits?: string | null;
  terms?: string | null;
  expiresAt?: string | null;
}) {
  const offer = await loadEnterpriseOffer(input.user, input.offerId);
  if (
    offer.status === "SENT" ||
    offer.status === "ACCEPTED" ||
    offer.status === "DECLINED" ||
    offer.status === "EXPIRED" ||
    offer.status === "WITHDRAWN"
  ) {
    throw new HiringConflictError("Không thể sửa đề nghị đã gửi hoặc đã đóng.");
  }
  if (
    typeof input.compensationAmount === "number" &&
    (!Number.isInteger(input.compensationAmount) || input.compensationAmount < 0)
  ) {
    throw new HiringInputError("Mức thù lao phải là số nguyên không âm.");
  }
  const next = {
    title: input.title ?? offer.title,
    employmentType: input.employmentType ?? offer.employmentType,
    compensationAmount: input.compensationAmount ?? offer.compensationAmount,
    currency: (input.currency ?? offer.currency).toUpperCase(),
    startDate:
      input.startDate === undefined
        ? offer.startDate
          ? offer.startDate.toISOString()
          : null
        : input.startDate,
    location: input.location === undefined ? offer.location : input.location,
    benefits: input.benefits === undefined ? offer.benefits : input.benefits,
    terms: input.terms === undefined ? offer.terms : input.terms,
  };
  const nextHash = materialHashForOffer(next);
  const materialChanged = isMaterialOfferChange(offer.materialHash, nextHash);
  const shouldReapprove =
    materialChanged && (offer.status === "APPROVED" || offer.status === "APPROVAL_PENDING");

  const updated = await prisma.$transaction(async (tx) => {
    if (shouldReapprove) {
      await tx.offerApproval.updateMany({
        where: { offerId: offer.id },
        data: { status: "PENDING", reason: null, decidedAt: null },
      });
    }
    return tx.offer.update({
      where: { id: offer.id },
      data: {
        title: next.title,
        employmentType: next.employmentType,
        compensationAmount: next.compensationAmount,
        currency: next.currency,
        startDate: next.startDate ? new Date(next.startDate) : null,
        location: next.location,
        benefits: next.benefits,
        terms: next.terms,
        expiresAt:
          input.expiresAt === undefined
            ? undefined
            : input.expiresAt
              ? new Date(input.expiresAt)
              : null,
        materialHash: nextHash,
        version: { increment: 1 },
        status: shouldReapprove ? "APPROVAL_PENDING" : offer.status,
      },
      include: { approvals: { orderBy: { orderIndex: "asc" } } },
    });
  });
  await writeAuditLog(input.user, "offer.updated", offer.id, {
    materialChanged,
    reapproval: shouldReapprove,
  });
  return updated;
}

export async function requestOfferApprovals(input: {
  user: AuthUserPayload;
  offerId: string;
  approverIds: string[];
  sequential?: boolean;
}) {
  const offer = await loadEnterpriseOffer(input.user, input.offerId);
  if (offer.status !== "DRAFT" && offer.status !== "APPROVAL_PENDING") {
    throw new HiringConflictError("Chỉ đề nghị nháp hoặc đang chờ duyệt mới gửi duyệt.");
  }
  const uniqueIds = [...new Set(input.approverIds.filter(Boolean))];
  if (uniqueIds.length === 0) throw new HiringInputError("Cần ít nhất một người duyệt.");
  const members = await prisma.companyMember.findMany({
    where: { companyId: offer.companyId, userId: { in: uniqueIds } },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((row) => row.userId));
  if (input.user.role !== "ADMIN") {
    for (const id of uniqueIds) {
      if (!memberIds.has(id) && id !== input.user.userId) {
        throw new HiringForbiddenError("Người duyệt phải thuộc cùng doanh nghiệp.");
      }
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.offerApproval.deleteMany({ where: { offerId: offer.id } });
    await tx.offerApproval.createMany({
      data: uniqueIds.map((approverId, index) => ({
        offerId: offer.id,
        approverId,
        orderIndex: index + 1,
        status: "PENDING",
      })),
    });
    await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: "APPROVAL_PENDING",
        sequentialApproval: input.sequential !== false,
        version: { increment: 1 },
      },
    });
  });
  await writeAuditLog(input.user, "offer.approval_requested", offer.id, { approverIds: uniqueIds });
  for (const approverId of uniqueIds) {
    await notify({
      userId: approverId,
      type: "offer.approval_requested",
      title: "Cần duyệt đề nghị tuyển dụng",
      body: `Đề nghị cho ${offer.application.job.title} đang chờ bạn duyệt.`,
      href: `/enterprise/candidates/${offer.applicationId}`,
      dedupeKey: `offer.approval_requested:${offer.id}:${approverId}`,
    });
  }
  return loadEnterpriseOffer(input.user, offer.id);
}

export async function decideOfferApproval(input: {
  user: AuthUserPayload;
  offerId: string;
  decision: "APPROVED" | "REJECTED";
  reason?: string | null;
}) {
  const offer = await loadEnterpriseOffer(input.user, input.offerId);
  if (offer.status !== "APPROVAL_PENDING")
    throw new HiringConflictError("Đề nghị không đang chờ duyệt.");
  const mine = offer.approvals.find((row) => row.approverId === input.user.userId);
  if (!mine) throw new HiringForbiddenError("Bạn không nằm trong danh sách duyệt đề nghị này.");
  if (mine.status !== "PENDING") {
    return { offer, already: true as const };
  }
  if (offer.sequentialApproval) {
    const blocker = offer.approvals.find(
      (row) => row.orderIndex < mine.orderIndex && row.status !== "APPROVED",
    );
    if (blocker) throw new HiringConflictError("Cần người duyệt trước bạn hoàn tất trước.");
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.offerApproval.updateMany({
      where: { id: mine.id, status: "PENDING" },
      data: { status: input.decision, reason: input.reason?.trim() || null, decidedAt: new Date() },
    });
    if (updated.count !== 1) throw new HiringConflictError("Lượt duyệt vừa được cập nhật.");
    if (input.decision === "REJECTED") {
      await tx.offer.update({
        where: { id: offer.id },
        data: { status: "DRAFT", version: { increment: 1 } },
      });
    } else {
      const remaining = await tx.offerApproval.count({
        where: { offerId: offer.id, status: { not: "APPROVED" } },
      });
      if (remaining === 0) {
        await tx.offer.update({
          where: { id: offer.id },
          data: { status: "APPROVED", version: { increment: 1 } },
        });
      }
    }
  });
  await writeAuditLog(
    input.user,
    input.decision === "APPROVED" ? "offer.approved" : "offer.approval_rejected",
    offer.id,
    {
      reason: input.reason ?? null,
    },
  );
  return { offer: await loadEnterpriseOffer(input.user, offer.id), already: false as const };
}

export async function sendOffer(input: {
  user: AuthUserPayload;
  offerId: string;
  expiresAt?: string | null;
}) {
  const offer = await loadEnterpriseOffer(input.user, input.offerId);
  if (offer.compensationAmount <= 0)
    throw new HiringInputError("Cần mức thù lao trước khi gửi đề nghị.");
  if (!canTransitionOffer(offer.status, "SENT"))
    throw new HiringConflictError("Chỉ gửi đề nghị đã được duyệt.");
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : offer.expiresAt;
  const moved = await prisma.offer.updateMany({
    where: { id: offer.id, status: "APPROVED" },
    data: { status: "SENT", sentAt: new Date(), expiresAt, version: { increment: 1 } },
  });
  if (moved.count !== 1)
    throw new HiringConflictError("Đề nghị vừa đổi trạng thái. Tải lại rồi thử lại.");
  await writeAuditLog(input.user, "offer.sent", offer.id);
  await notify({
    userId: offer.candidateUserId,
    type: "offer.sent",
    title: "Bạn nhận được đề nghị tuyển dụng",
    body: `Doanh nghiệp đã gửi đề nghị cho vị trí ${offer.title}.`,
    href: "/applications",
    dedupeKey: `offer.sent:${offer.id}`,
  });
  const { publishPipelineChanged, publishToUser } = await import("@/lib/realtime-hub");
  publishPipelineChanged();
  publishToUser(offer.candidateUserId, "notification");
  return loadEnterpriseOffer(input.user, offer.id);
}

export async function withdrawOffer(input: { user: AuthUserPayload; offerId: string }) {
  const offer = await loadEnterpriseOffer(input.user, input.offerId);
  if (!canTransitionOffer(offer.status, "WITHDRAWN") && offer.status !== "DRAFT") {
    throw new HiringConflictError("Không thể thu hồi đề nghị ở trạng thái hiện tại.");
  }
  const moved = await prisma.offer.updateMany({
    where: { id: offer.id, status: { in: ["DRAFT", "APPROVAL_PENDING", "APPROVED", "SENT"] } },
    data: { status: "WITHDRAWN", withdrawnAt: new Date(), version: { increment: 1 } },
  });
  if (moved.count !== 1) throw new HiringConflictError("Đề nghị vừa đổi trạng thái.");
  await prisma.application.updateMany({
    where: { id: offer.applicationId, status: "OFFER_PENDING" },
    data: { status: "HOLD", version: { increment: 1 } },
  });
  await writeAuditLog(input.user, "offer.withdrawn", offer.id);
  if (offer.status === "SENT") {
    await notify({
      userId: offer.candidateUserId,
      type: "offer.withdrawn",
      title: "Đề nghị đã được thu hồi",
      body: `Đề nghị cho ${offer.title} không còn hiệu lực.`,
      href: "/applications",
      dedupeKey: `offer.withdrawn:${offer.id}`,
    });
  }
  const { publishPipelineChanged, publishToUser } = await import("@/lib/realtime-hub");
  publishPipelineChanged();
  publishToUser(offer.candidateUserId, "notification");
  return loadEnterpriseOffer(input.user, offer.id);
}

export async function respondToOffer(input: {
  user: AuthUserPayload;
  applicationId: string;
  decision: "ACCEPTED" | "DECLINED";
}) {
  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, userId: input.user.userId },
    include: {
      offers: {
        where: {
          status: {
            in: [
              "DRAFT",
              "APPROVAL_PENDING",
              "APPROVED",
              "SENT",
              "ACCEPTED",
              "DECLINED",
              "EXPIRED",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      },
      job: { select: { title: true, companyId: true } },
    },
  });
  if (!application) throw new HiringNotFoundError("Hồ sơ không tồn tại.");
  if (application.status === "WITHDRAWN") throw new HiringConflictError("Hồ sơ đã được rút lại.");
  const offer = application.offers.find((row) => row.status === "SENT") ?? application.offers[0];
  if (!offer || offer.candidateUserId !== input.user.userId) {
    throw new HiringNotFoundError("Không có đề nghị đang chờ bạn phản hồi.");
  }
  if (offer.status === "ACCEPTED" && input.decision === "ACCEPTED") {
    return { already: true as const, offer, hired: application.status === "HIRED" };
  }
  if (offer.status === "DECLINED" && input.decision === "DECLINED") {
    return { already: true as const, offer, hired: false };
  }
  if (offer.status === "EXPIRED") throw new HiringConflictError("Đề nghị đã hết hạn.");
  if (offer.status === "WITHDRAWN") throw new HiringConflictError("Đề nghị đã được thu hồi.");
  if (offer.status !== "SENT") throw new HiringConflictError("Đề nghị không còn mở để phản hồi.");

  const nextStatus = input.decision;
  if (!canTransitionOffer("SENT", nextStatus))
    throw new HiringConflictError("Không thể phản hồi đề nghị ở trạng thái hiện tại.");

  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();
    if (offer.expiresAt && offer.expiresAt.getTime() <= now.getTime()) {
      await tx.offer.updateMany({
        where: { id: offer.id, status: "SENT" },
        data: { status: "EXPIRED", version: { increment: 1 } },
      });
      await tx.application.updateMany({
        where: { id: application.id, status: "OFFER_PENDING" },
        data: { status: "HOLD", version: { increment: 1 } },
      });
      return { kind: "expired" as const, hired: false };
    }
    const moved = await tx.offer.updateMany({
      where: {
        id: offer.id,
        status: "SENT",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { status: nextStatus, respondedAt: now, version: { increment: 1 } },
    });
    if (moved.count !== 1) {
      const latest = await tx.offer.findUnique({
        where: { id: offer.id },
        select: { status: true, expiresAt: true },
      });
      if (
        latest?.status === "SENT" &&
        latest.expiresAt &&
        latest.expiresAt.getTime() <= now.getTime()
      ) {
        await tx.offer.updateMany({
          where: { id: offer.id, status: "SENT" },
          data: { status: "EXPIRED", version: { increment: 1 } },
        });
        await tx.application.updateMany({
          where: { id: application.id, status: "OFFER_PENDING" },
          data: { status: "HOLD", version: { increment: 1 } },
        });
        return { kind: "expired" as const, hired: false };
      }
      return { kind: "conflict" as const, hired: false };
    }
    if (nextStatus === "ACCEPTED") {
      // REQ-0002: sole writer of Application.status HIRED
      const hired = await tx.application.updateMany({
        where: { id: application.id, status: { notIn: ["HIRED", "REJECTED", "WITHDRAWN"] } },
        data: { status: "HIRED", version: { increment: 1 }, decisionAt: now },
      });
      return { kind: "ok" as const, hired: hired.count === 1 };
    }
    await tx.application.updateMany({
      where: { id: application.id, status: "OFFER_PENDING" },
      data: { status: "HOLD", version: { increment: 1 } },
    });
    return { kind: "ok" as const, hired: false };
  });
  if (result.kind === "expired") throw new HiringConflictError("Đề nghị đã hết hạn.");
  if (result.kind === "conflict")
    throw new HiringConflictError("Đề nghị vừa đổi trạng thái. Tải lại rồi thử lại.");

  await writeAuditLog(
    input.user,
    nextStatus === "ACCEPTED" ? "offer.accepted" : "offer.declined",
    offer.id,
    {
      applicationId: application.id,
      hired: result.hired,
    },
  );
  if (result.hired) {
    await writeAuditLog(input.user, "application.hired", application.id, { offerId: offer.id });
    await notify({
      userId: offer.createdById,
      type: "candidate.hired",
      title: "Ứng viên đã nhận việc",
      body: `${input.user.fullName} đã chấp nhận đề nghị ${offer.title}.`,
      href: `/enterprise/candidates/${application.id}`,
      dedupeKey: `candidate.hired:${application.id}`,
    });
  }
  const { publishPipelineChanged, publishToUser } = await import("@/lib/realtime-hub");
  publishPipelineChanged();
  publishToUser(input.user.userId, "notification");
  publishToUser(offer.createdById, "notification");
  const latest = await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } });
  return { already: false as const, offer: latest, hired: result.hired };
}

export async function getCandidateOffer(user: AuthUserPayload, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.userId },
    select: {
      id: true,
      status: true,
      candidateMessage: true,
      offers: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!application) throw new HiringNotFoundError("Hồ sơ không tồn tại.");
  const publicOffer = application.offers.find((offer) => offerIsPublicToCandidate(offer.status));
  if (!publicOffer) return { offer: null, candidateMessage: application.candidateMessage };
  if (expireIfNeeded(publicOffer)) {
    await prisma.$transaction(async (tx) => {
      await tx.offer.updateMany({
        where: { id: publicOffer.id, status: "SENT" },
        data: { status: "EXPIRED", version: { increment: 1 } },
      });
      await tx.application.updateMany({
        where: { id: application.id, status: "OFFER_PENDING" },
        data: { status: "HOLD", version: { increment: 1 } },
      });
    });
    publicOffer.status = "EXPIRED";
  }
  return {
    candidateMessage: application.candidateMessage,
    offer: toPublicOffer(publicOffer),
  };
}

export function toPublicOffer(offer: {
  id: string;
  applicationId: string;
  title: string;
  employmentType: string;
  compensationAmount: number;
  currency: string;
  startDate: Date | null;
  location: string | null;
  benefits: string | null;
  terms: string | null;
  expiresAt: Date | null;
  status: OfferStatus;
  sentAt: Date | null;
  respondedAt: Date | null;
}) {
  return {
    id: offer.id,
    applicationId: offer.applicationId,
    title: offer.title,
    employmentType: offer.employmentType,
    compensationAmount: offer.compensationAmount,
    currency: offer.currency,
    startDate: offer.startDate?.toISOString() ?? null,
    location: offer.location,
    benefits: offer.benefits,
    terms: offer.terms,
    expiresAt: offer.expiresAt?.toISOString() ?? null,
    status: offer.status,
    sentAt: offer.sentAt?.toISOString() ?? null,
    respondedAt: offer.respondedAt?.toISOString() ?? null,
  };
}

export function toEnterpriseOffer(offer: Awaited<ReturnType<typeof loadEnterpriseOffer>>) {
  return {
    id: offer.id,
    applicationId: offer.applicationId,
    version: offer.version,
    status: offer.status,
    title: offer.title,
    employmentType: offer.employmentType,
    compensationAmount: offer.compensationAmount,
    currency: offer.currency,
    startDate: offer.startDate?.toISOString() ?? null,
    location: offer.location,
    benefits: offer.benefits,
    terms: offer.terms,
    expiresAt: offer.expiresAt?.toISOString() ?? null,
    sequentialApproval: offer.sequentialApproval,
    createdBy: offer.createdBy,
    approvals: offer.approvals.map((row) => ({
      id: row.id,
      approverId: row.approverId,
      approverName: row.approver.fullName,
      orderIndex: row.orderIndex,
      status: row.status,
      reason: row.reason,
      decidedAt: row.decidedAt?.toISOString() ?? null,
    })),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  };
}

export async function getEnterpriseOfferForApplication(
  user: AuthUserPayload,
  applicationId: string,
) {
  const application = await loadEnterpriseApplication(user, applicationId);
  const offer = application.offers[0];
  if (!offer) return null;
  return toEnterpriseOffer(await loadEnterpriseOffer(user, offer.id));
}

export async function notifyInterviewCompleted(input: {
  sessionId: string;
  applicationId: string | null;
  candidateUserId: string;
  jobTitle: string;
}) {
  await notify({
    userId: input.candidateUserId,
    type: "interview.completed",
    title: "Đã hoàn thành phỏng vấn",
    body: input.applicationId
      ? `Bạn đã hoàn tất vòng phỏng vấn AI cho ${input.jobTitle}. Doanh nghiệp sẽ xem xét hồ sơ.`
      : "Buổi luyện phỏng vấn AI đã hoàn tất.",
    href: input.applicationId ? "/applications" : `/interview/report/${input.sessionId}`,
    dedupeKey: `interview.completed:${input.sessionId}`,
  });
  if (!input.applicationId) return;
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    select: { job: { select: { company: { select: { members: { select: { userId: true } } } } } } },
  });
  for (const member of application?.job.company.members ?? []) {
    await notify({
      userId: member.userId,
      type: "interview.review_ready",
      title: "Có hồ sơ cần xem xét",
      body: `Một ứng viên đã hoàn tất phỏng vấn AI cho ${input.jobTitle}.`,
      href: `/enterprise/candidates/${input.applicationId}`,
      dedupeKey: `interview.review_ready:${input.sessionId}:${member.userId}`,
    });
  }
}
