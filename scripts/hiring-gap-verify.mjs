import { candidatePassword, staffPassword } from "./verify-credentials.mjs";
const BASE = process.env.VERIFY_BASE ?? "http://127.0.0.1:3000";

async function login(email, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => null);
  const token = /pivotassist_session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1];
  if (!response.ok || !token) throw new Error(`login ${email}: ${payload?.error ?? response.status}`);
  return token;
}

function headers(token) {
  return { cookie: `pivotassist_session=${token}`, "content-type": "application/json" };
}

async function json(path, token, init = {}) {
  const started = Date.now();
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers(token), ...init.headers } });
  const payload = await response.json().catch(() => null);
  return { response, payload, ms: Date.now() - started };
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function prepareApprovedOffer(actor, applicationId) {
  const created = await json(`/api/enterprise/applications/${applicationId}/offers`, actor, { method: "POST" });
  const offerId = created.payload?.offer?.id;
  if (!offerId) return { offerId: null, created };
  await json(`/api/enterprise/offers/${offerId}`, actor, {
    method: "PATCH",
    body: JSON.stringify({ compensationAmount: 18_000_000, currency: "VND", terms: "Hợp đồng thử việc" }),
  });
  const me = await json("/api/auth/me", actor);
  const approverId = me.payload?.user?.userId;
  await json(`/api/enterprise/offers/${offerId}/approvals`, actor, {
    method: "POST",
    body: JSON.stringify({ approverIds: [approverId], sequential: true }),
  });
  await json(`/api/enterprise/offers/${offerId}/approvals`, actor, {
    method: "POST",
    body: JSON.stringify({ decision: "APPROVED" }),
  });
  return { offerId, created };
}

async function sendReadyOffer(actor, applicationId) {
  const prepared = await prepareApprovedOffer(actor, applicationId);
  if (!prepared.offerId) return { ...prepared, sent: null };
  const sent = await json(`/api/enterprise/offers/${prepared.offerId}/send`, actor, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { ...prepared, sent };
}

async function main() {
  const recruiter = await login("recruiter@nexusai.local", staffPassword());
  const admin = await login("admin@pivotassist.local", staffPassword());
  const ha = await login("ha.le@example.com", candidatePassword());
  const quang = await login("quang.tran@example.com", candidatePassword());
  const nam = await login("nam.nguyen@example.com", candidatePassword());
  const ngoc = await login("ngoc.vu@example.com", candidatePassword());

  const tenant = await json("/api/enterprise/applications/seed_app_quang_backend", recruiter);
  record("Nexus recruiter cannot read Vanguard file", tenant.response.status === 404, String(tenant.response.status));

  const candidateEnterprise = await json("/api/enterprise/applications/seed_app_ha_frontend", ha);
  record("candidate cannot read enterprise application", candidateEnterprise.response.status === 401, String(candidateEnterprise.response.status));

  const directHired = await json("/api/enterprise/applications/seed_app_ha_frontend", recruiter, {
    method: "PATCH",
    body: JSON.stringify({ status: "HIRED" }),
  });
  record("direct HIRED blocked", directHired.response.status === 409, directHired.payload?.error);

  const haLive = await json("/api/applications/seed_app_ha_frontend", ha);
  const openSession = (haLive.payload?.application?.interviews ?? []).find((row) => row.status !== "COMPLETED");
  let completeTarget = openSession?.id;
  if (!completeTarget) {
    const started = await json("/api/applications/seed_app_ha_frontend/interview", ha, {
      method: "POST",
      body: JSON.stringify({ questionCount: 3, language: "vi", difficulty: "mid" }),
    });
    completeTarget = started.payload?.session?.id;
  }
  const completed = await json(`/api/interviews/${completeTarget}/complete`, ha, {
    method: "POST",
    body: JSON.stringify({ durationSeconds: 90 }),
  });
  const haAfterComplete = await json("/api/enterprise/applications/seed_app_ha_frontend", recruiter);
  record(
    "complete later round keeps SHORTLISTED and skips Gemini on hot path",
    completed.response.ok
      && completed.payload?.provider === "free-heuristic-v1"
      && completed.ms < 3000
      && haAfterComplete.payload?.application?.status === "SHORTLISTED",
    `ms=${completed.ms} provider=${completed.payload?.provider} status=${haAfterComplete.payload?.application?.status ?? completed.payload?.error}`,
  );

  const report = await json(`/api/interviews/${completeTarget}/report`, ha);
  const reportText = JSON.stringify(report.payload);
  record(
    "candidate report is PostInterviewResult-safe",
    report.payload?.audience === "candidate"
      && report.payload?.report?.score == null
      && report.payload?.report?.candidateFacing
      && !("applicationStatus" in (report.payload?.report ?? {}))
      && !reportText.includes("internalReason")
      && !reportText.includes("modelName"),
    `${report.payload?.audience} facing=${report.payload?.report?.candidateFacing}`,
  );

  const rejected = await json("/api/enterprise/applications/seed_app_ha_frontend", recruiter, {
    method: "PATCH",
    body: JSON.stringify({
      action: "REJECT",
      internalReason: "Không khớp seniority frontend.",
      candidateMessage: "Cảm ơn bạn. Hiện chưa phù hợp với Senior Frontend.",
    }),
  });
  const haFacing = await json("/api/applications/seed_app_ha_frontend", ha);
  const haDump = JSON.stringify(haFacing.payload);
  record(
    "REJECT with internal reason stays internal",
    rejected.response.ok
      && rejected.payload?.application?.status === "REJECTED"
      && haFacing.payload?.application?.candidateFacing === "not_a_fit"
      && haFacing.payload?.application?.candidateMessage?.includes("chưa phù hợp")
      && !haDump.includes("Không khớp seniority")
      && !haDump.includes("internalReason"),
    haFacing.payload?.application?.candidateFacing ?? rejected.payload?.error,
  );

  const haNotes = await json("/api/notifications", ha);
  record(
    "REJECT notifies candidate",
    (haNotes.payload?.notifications ?? []).some((row) => row.type === "application.rejected"),
    `count=${(haNotes.payload?.notifications ?? []).length}`,
  );

  const afterReject = await json("/api/enterprise/applications/seed_app_ha_frontend", recruiter, {
    method: "PATCH",
    body: JSON.stringify({ action: "HOLD" }),
  });
  record("closed file cannot HOLD", afterReject.response.status === 409, afterReject.payload?.error);

  const ngocSession = await json("/api/applications/seed_app_ngoc_ai/interview", ngoc, {
    method: "POST",
    body: JSON.stringify({ questionCount: 3, language: "vi", difficulty: "mid" }),
  });
  const ngocComplete = await json(`/api/interviews/${ngocSession.payload?.session?.id}/complete`, ngoc, {
    method: "POST",
    body: JSON.stringify({ durationSeconds: 45 }),
  });
  const ngocApp = await json("/api/applications/seed_app_ngoc_ai", ngoc);
  record(
    "first-cycle complete stays heuristic on hot path",
    ngocComplete.response.ok
      && ngocComplete.payload?.provider === "free-heuristic-v1"
      && ngocComplete.ms < 3000
      && ngocApp.payload?.application?.status === "AI_INTERVIEW_COMPLETED",
    `ms=${ngocComplete.ms} reused=${ngocSession.payload?.reused} status=${ngocApp.payload?.application?.status}`,
  );

  const sent = await sendReadyOffer(admin, "seed_app_quang_backend");
  const quangList = await json("/api/applications", quang);
  const quangRow = (quangList.payload?.applications ?? []).find((row) => row.id === "seed_app_quang_backend");
  const quangDump = JSON.stringify(quangList.payload);
  record(
    "SENT offer is candidate-facing only",
    quangRow?.candidateFacing === "offer_received"
      && quangRow?.offer?.status === "SENT"
      && quangRow?.offer?.compensationAmount === 18_000_000
      && !quangDump.includes("internalReason")
      && !quangDump.includes("privateNote"),
    `${quangRow?.candidateFacing} amount=${quangRow?.offer?.compensationAmount} err=${sent.sent?.payload?.error ?? ""}`,
  );

  const declined = await json("/api/applications/seed_app_quang_backend/offer", quang, {
    method: "POST",
    body: JSON.stringify({ decision: "DECLINED" }),
  });
  const afterDecline = await json("/api/applications/seed_app_quang_backend", quang);
  record(
    "decline returns pipeline to HOLD",
    declined.response.ok
      && declined.payload?.offer?.status === "DECLINED"
      && afterDecline.payload?.application?.status === "HOLD"
      && afterDecline.payload?.application?.candidateFacing === "under_review",
    `${afterDecline.payload?.application?.status}/${afterDecline.payload?.application?.candidateFacing}`,
  );

  const accepted = await sendReadyOffer(admin, "seed_app_quang_backend");
  const hire = await json("/api/applications/seed_app_quang_backend/offer", quang, {
    method: "POST",
    body: JSON.stringify({ decision: "ACCEPTED" }),
  });
  const hiredApp = await json("/api/applications/seed_app_quang_backend", quang);
  record(
    "accept offer is the only path to HIRED",
    hire.response.ok
      && hire.payload?.hired === true
      && hire.payload?.offer?.status === "ACCEPTED"
      && hiredApp.payload?.application?.status === "HIRED"
      && hiredApp.payload?.application?.candidateFacing === "hired",
    `hired=${hire.payload?.hired} status=${hiredApp.payload?.application?.status} sendErr=${accepted.sent?.payload?.error ?? ""}`,
  );

  const adminNotes = await json("/api/notifications", admin);
  record(
    "accept notifies hiring side",
    (adminNotes.payload?.notifications ?? []).some((row) => row.type === "candidate.hired"),
    (adminNotes.payload?.notifications ?? []).map((row) => row.type).slice(0, 8).join(","),
  );

  const namIdor = await json("/api/applications/seed_app_quang_backend/offer", nam);
  record("nam cannot read quang offer", namIdor.response.status === 404, String(namIdor.response.status));

  const { prisma } = await import("../packages/db/dist/index.js");
  const audits = await prisma.auditLog.findMany({
    where: { action: { in: ["application.decision", "offer.accepted", "application.hired", "offer.declined"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  record(
    "decisions and hire write audit logs",
    audits.some((row) => row.action === "application.decision")
      && audits.some((row) => row.action === "offer.accepted")
      && audits.some((row) => row.action === "application.hired"),
    audits.map((row) => row.action).slice(0, 8).join(","),
  );
  await prisma.$disconnect();

  const jobs = await fetch(`${BASE}/jobs`);
  const html = await jobs.text();
  record("jobs SSR leftover chrome still clean", jobs.ok && !html.includes("Đang tải việc làm") && !html.includes("Master CV") && !html.includes("ATS ranking"), `status=${jobs.status}`);

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ passed: results.filter((item) => item.ok).length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
