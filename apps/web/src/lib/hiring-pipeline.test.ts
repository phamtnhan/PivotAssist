import assert from "node:assert/strict";
import test from "node:test";
import {
  canDecideFrom,
  canTransitionOffer,
  decisionIdempotencyKey,
  isMaterialOfferChange,
  materialHashForOffer,
  offerIsPublicToCandidate,
  pipelineAfterDecision,
  pipelineAfterSessionComplete,
  reapplyPolicy,
  recommendationFromScore,
  toCandidateFacingStatus,
} from "./hiring-pipeline.ts";

test("decision maps stay split from offer and candidate-facing states", () => {
  assert.equal(pipelineAfterDecision("NEXT_INTERVIEW"), "SHORTLISTED");
  assert.equal(pipelineAfterDecision("PROCEED_TO_OFFER"), "OFFER_PENDING");
  assert.equal(pipelineAfterDecision("REJECT"), "REJECTED");
  assert.notEqual(pipelineAfterDecision("PROCEED_TO_OFFER"), "HIRED");
});

test("candidate never sees offer until SENT", () => {
  assert.equal(toCandidateFacingStatus({ pipeline: "OFFER_PENDING" }), "under_review");
  assert.equal(
    toCandidateFacingStatus({ pipeline: "OFFER_PENDING", offerStatus: "DRAFT" }),
    "under_review",
  );
  assert.equal(
    toCandidateFacingStatus({ pipeline: "OFFER_PENDING", offerStatus: "SENT" }),
    "offer_received",
  );
  assert.equal(offerIsPublicToCandidate("DRAFT"), false);
  assert.equal(offerIsPublicToCandidate("SENT"), true);
});

test("completing a later AI round does not reset pipeline", () => {
  assert.equal(pipelineAfterSessionComplete("SUBMITTED"), "AI_INTERVIEW_COMPLETED");
  assert.equal(pipelineAfterSessionComplete("AI_INTERVIEW_PENDING"), "AI_INTERVIEW_COMPLETED");
  assert.equal(pipelineAfterSessionComplete("AI_INTERVIEW_IN_PROGRESS"), "AI_INTERVIEW_COMPLETED");
  assert.equal(pipelineAfterSessionComplete("SHORTLISTED"), null);
  assert.equal(pipelineAfterSessionComplete("HOLD"), null);
  assert.equal(pipelineAfterSessionComplete("ADDITIONAL_ASSESSMENT"), null);
  assert.equal(pipelineAfterSessionComplete("FACE_TO_FACE_SCHEDULED"), null);
  assert.equal(pipelineAfterSessionComplete("OFFER_PENDING"), null);
});

test("in-progress next round stays decidable when a prior score exists", () => {
  assert.equal(
    canDecideFrom("AI_INTERVIEW_IN_PROGRESS", "HOLD", { hasReadyEvaluation: true }).ok,
    true,
  );
  assert.equal(
    canDecideFrom("AI_INTERVIEW_IN_PROGRESS", "ADDITIONAL_ASSESSMENT", {
      hasReadyEvaluation: false,
    }).ok,
    false,
  );
  assert.equal(canDecideFrom("AI_INTERVIEW_PENDING", "HOLD").ok, false);
});

test("re-apply never overwrites HIRED or REJECTED", () => {
  assert.equal(reapplyPolicy("HIRED"), "reject");
  assert.equal(reapplyPolicy("REJECTED"), "reject");
  assert.equal(reapplyPolicy("WITHDRAWN"), "reopen");
  assert.equal(reapplyPolicy("AI_INTERVIEW_PENDING"), "keep");
  assert.equal(reapplyPolicy("OFFER_PENDING"), "keep");
  assert.equal(reapplyPolicy("SHORTLISTED"), "keep");
});

test("reject and proceed cannot run from a closed hire", () => {
  assert.equal(canDecideFrom("HIRED", "REJECT").ok, false);
  assert.equal(canDecideFrom("REJECTED", "PROCEED_TO_OFFER").ok, false);
  assert.equal(canDecideFrom("REJECTED", "REJECT").ok, true);
});

test("sent offer blocks reject until withdrawn", () => {
  const blocked = canDecideFrom("OFFER_PENDING", "REJECT", {
    offerStatus: "SENT",
    hasActiveOffer: true,
  });
  assert.equal(blocked.ok, false);
});

test("offer state machine", () => {
  assert.equal(canTransitionOffer("DRAFT", "APPROVAL_PENDING"), true);
  assert.equal(canTransitionOffer("APPROVED", "SENT"), true);
  assert.equal(canTransitionOffer("SENT", "ACCEPTED"), true);
  assert.equal(canTransitionOffer("DRAFT", "ACCEPTED"), false);
  assert.equal(canTransitionOffer("SENT", "DRAFT"), false);
});

test("material hash invalidates approval payload", () => {
  const left = materialHashForOffer({
    title: "Kỹ sư",
    employmentType: "FULL_TIME",
    compensationAmount: 20_000_000,
    currency: "VND",
    startDate: "2026-10-01",
    location: "Hà Nội",
    benefits: null,
    terms: "Thử việc 2 tháng",
  });
  const right = materialHashForOffer({
    title: "Kỹ sư",
    employmentType: "FULL_TIME",
    compensationAmount: 25_000_000,
    currency: "VND",
    startDate: "2026-10-01",
    location: "Hà Nội",
    benefits: null,
    terms: "Thử việc 2 tháng",
  });
  assert.equal(isMaterialOfferChange(left, right), true);
});

test("AI recommendation is support only and score-derived", () => {
  assert.equal(recommendationFromScore(90), "ADVANCE");
  assert.equal(recommendationFromScore(70), "HOLD");
  assert.equal(recommendationFromScore(40), "REJECT");
});

test("idempotency key is version-scoped", () => {
  assert.equal(decisionIdempotencyKey("REJECT", 3), "REJECT:v3");
  assert.notEqual(decisionIdempotencyKey("REJECT", 3), decisionIdempotencyKey("REJECT", 4));
});
