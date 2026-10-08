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

function headers(token, extra = {}) {
  return { cookie: `pivotassist_session=${token}`, "content-type": "application/json", ...extra };
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

async function prepareApprovedOffer(recruiter, applicationId) {
  const created = await json(`/api/enterprise/applications/${applicationId}/offers`, recruiter, { method: "POST" });
  const offerId = created.payload?.offer?.id;
  if (!offerId) return { created, offerId: null, approved: null };
  await json(`/api/enterprise/offers/${offerId}`, recruiter, {
    method: "PATCH",
    body: JSON.stringify({ compensationAmount: 18_000_000, currency: "VND", terms: "Hợp đồng thử việc" }),
  });
  const me = await json("/api/auth/me", recruiter);
  const approverId = me.payload?.user?.userId;
  await json(`/api/enterprise/offers/${offerId}/approvals`, recruiter, {
    method: "POST",
    body: JSON.stringify({ approverIds: [approverId], sequential: true }),
  });
  const approved = await json(`/api/enterprise/offers/${offerId}/approvals`, recruiter, {
    method: "POST",
    body: JSON.stringify({ decision: "APPROVED" }),
  });
  return { created, offerId, approved };
}

async function sendReadyOffer(recruiter, applicationId, expiresAt) {
  const prepared = await prepareApprovedOffer(recruiter, applicationId);
  if (!prepared.offerId) return { ...prepared, sent: null };
  const sent = await json(`/api/enterprise/offers/${prepared.offerId}/send`, recruiter, {
    method: "POST",
    body: JSON.stringify(expiresAt ? { expiresAt } : {}),
  });
  return { ...prepared, sent };
}

async function main() {
  const recruiter = await login("recruiter@nexusai.local", staffPassword());
  const admin = await login("admin@pivotassist.local", staffPassword());
  const ha = await login("ha.le@example.com", candidatePassword());
  const quang = await login("quang.tran@example.com", candidatePassword());
  const nam = await login("nam.nguyen@example.com", candidatePassword());

  const hold = await json("/api/enterprise/applications/seed_app_ha_frontend", recruiter, {
    method: "PATCH",
    body: JSON.stringify({ action: "HOLD" }),
  });
  record("HOLD on open file", hold.response.ok && hold.payload?.application?.status === "HOLD", hold.payload?.application?.status ?? hold.payload?.error);

  const haList = await json("/api/applications", ha);
  const haApp = (haList.payload?.applications ?? []).find((row) => row.id === "seed_app_ha_frontend");
  record("candidate facing after HOLD", haApp?.candidateFacing === "under_review" && !JSON.stringify(haList.payload).includes("internalReason"), haApp?.candidateFacing);

  const extra = await json("/api/enterprise/applications/seed_app_ha_frontend", recruiter, {
    method: "PATCH",
    body: JSON.stringify({ action: "ADDITIONAL_ASSESSMENT", candidateMessage: "Cần thêm ví dụ vận hành ca." }),
  });
  record("ADDITIONAL_ASSESSMENT", extra.response.ok && extra.payload?.application?.status === "ADDITIONAL_ASSESSMENT", extra.payload?.application?.status ?? extra.payload?.error);

  const haAgain = await json("/api/applications/seed_app_ha_frontend", ha);
  record(
    "candidate need_info + public message",
    haAgain.payload?.application?.candidateFacing === "need_info" && haAgain.payload?.application?.candidateMessage?.includes("vận hành"),
    `${haAgain.payload?.application?.candidateFacing} msg=${haAgain.payload?.application?.candidateMessage ?? "null"}`,
  );

  const session = await json("/api/applications/seed_app_ha_frontend/interview", ha, {
    method: "POST",
    body: JSON.stringify({ questionCount: 3, language: "vi", difficulty: "mid" }),
  });
  record("next AI round created", session.response.ok && session.payload?.session?.id, `${session.payload?.session?.id ?? session.payload?.error} reused=${session.payload?.reused} ms=${session.ms}`);

  const report = await json(`/api/interviews/${session.payload?.session?.id}/report`, ha);
  record("new round report stays candidate-safe", report.payload?.audience === "candidate" && report.payload?.report?.score == null, report.payload?.audience);

  const adminReview = await json("/api/enterprise/applications/seed_app_ha_frontend/reviews", admin, {
    method: "POST",
    body: JSON.stringify({ status: "SUBMITTED", overallRecommendation: "HOLD", comment: "Admin đã nộp", privateNote: "Ghi chú admin" }),
  });
  const recruiterPeek = await json("/api/enterprise/applications/seed_app_ha_frontend/reviews", recruiter);
  const reviewRows = recruiterPeek.payload?.reviews ?? [];
  const hidden = reviewRows.some((row) => row.hiddenUntilYouSubmit);
  const leakedPrivate = JSON.stringify(recruiterPeek.payload).includes("Ghi chú admin");
  record(
    "other scorecard hidden until submit",
    recruiterPeek.response.ok && !leakedPrivate && (hidden || reviewRows.length >= 2),
    JSON.stringify(reviewRows.map((row) => ({ hidden: row.hiddenUntilYouSubmit, comment: row.comment }))),
  );

  const recruiterReview = await json("/api/enterprise/applications/seed_app_ha_frontend/reviews", recruiter, {
    method: "POST",
    body: JSON.stringify({ status: "SUBMITTED", overallRecommendation: "ADVANCE", comment: "Recruiter đã nộp" }),
  });
  record("second reviewer can submit without overwrite", recruiterReview.response.ok && (recruiterReview.payload?.reviews ?? []).length >= 2, recruiterReview.payload?.reviews?.length);

  const rejectNeedReason = await json("/api/enterprise/applications/seed_app_quang_backend", admin, {
    method: "PATCH",
    body: JSON.stringify({ action: "REJECT" }),
  });
  record("REJECT without internal reason blocked", rejectNeedReason.response.status === 400, rejectNeedReason.payload?.error);

  const material = await prepareApprovedOffer(admin, "seed_app_quang_backend");
  const afterApprovePatch = await json(`/api/enterprise/offers/${material.offerId}`, admin, {
    method: "PATCH",
    body: JSON.stringify({ compensationAmount: 22_000_000 }),
  });
  record("material change after approval reopens approval", afterApprovePatch.response.ok && afterApprovePatch.payload?.offer?.status === "APPROVAL_PENDING", afterApprovePatch.payload?.offer?.status ?? afterApprovePatch.payload?.error);
  if (material.offerId) await json(`/api/enterprise/offers/${material.offerId}/withdraw`, admin, { method: "POST" });

  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const expired = await sendReadyOffer(admin, "seed_app_quang_backend", expiredAt);
  const acceptExpired = await json(`/api/applications/seed_app_quang_backend/offer`, quang, {
    method: "POST",
    body: JSON.stringify({ decision: "ACCEPTED" }),
  });
  record("expired accept blocked", acceptExpired.response.status === 409 && /hết hạn/i.test(acceptExpired.payload?.error ?? ""), acceptExpired.payload?.error);
  if (expired.offerId) await json(`/api/enterprise/offers/${expired.offerId}/withdraw`, admin, { method: "POST" });

  const raceOffer = await sendReadyOffer(admin, "seed_app_quang_backend");
  const [withdraw, accept] = await Promise.all([
    json(`/api/enterprise/offers/${raceOffer.offerId}/withdraw`, admin, { method: "POST" }),
    json(`/api/applications/seed_app_quang_backend/offer`, quang, { method: "POST", body: JSON.stringify({ decision: "ACCEPTED" }) }),
  ]);
  const withdrawWon = withdraw.response.ok && withdraw.payload?.offer?.status === "WITHDRAWN";
  const acceptWon = accept.response.ok && accept.payload?.offer?.status === "ACCEPTED";
  record("withdraw/accept one winner", Number(withdrawWon) + Number(acceptWon) === 1, `withdraw=${withdraw.response.status}/${withdraw.payload?.offer?.status} accept=${accept.response.status}/${accept.payload?.offer?.status}`);

  const namHired = await json("/api/applications/seed_app_nam_frontend/offer", nam);
  record("hired candidate still sees accepted offer only", namHired.payload?.offer?.status === "ACCEPTED" && !JSON.stringify(namHired.payload).includes("privateNote"), namHired.payload?.offer?.status);

  const idor = await json("/api/applications/seed_app_quang_backend/offer", nam);
  record("nam cannot read quang offer", idor.response.status === 404, String(idor.response.status));

  const sessionBody = { targetRole: "Chuyên viên kinh doanh", questionCount: 5, language: "vi", difficulty: "mid" };
  await json("/api/interviews/session", nam, { method: "POST", body: JSON.stringify(sessionBody) });
  await json("/api/interviews/session", nam, { method: "POST", body: JSON.stringify(sessionBody) });
  const sessionWarm = await json("/api/interviews/session", nam, { method: "POST", body: JSON.stringify(sessionBody) });
  record("practice session hot path", sessionWarm.response.ok && sessionWarm.ms < 3000, `ms=${sessionWarm.ms} status=${sessionWarm.response.status}`);

  const jobs = await fetch(`${BASE}/jobs`);
  const html = await jobs.text();
  record("jobs SSR still lists roles", jobs.ok && !html.includes("Đang tải việc làm") && (html.includes("Trưởng phòng") || html.includes("Frontend")), `status=${jobs.status} len=${html.length}`);

  record("jobs HTML no leftover chrome", !html.includes("Master CV") && !html.includes("ATS ranking"), "");

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ passed: results.filter((item) => item.ok).length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
