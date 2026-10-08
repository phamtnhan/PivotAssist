import { candidatePassword, staffPassword } from "./verify-credentials.mjs";
const BASE = process.env.VERIFY_BASE ?? "http://localhost:3000";

async function login(email, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => null);
  const token = /pivotassist_session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1];
  if (!response.ok || !token) throw new Error(`login ${email}: ${payload?.error ?? response.status}`);
  return token;
}

function headers(token) {
  return { cookie: `pivotassist_session=${token}`, "content-type": "application/json", origin: "http://localhost:3000" };
}

async function json(path, token, init = {}) {
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers(token), ...init.headers } });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function record(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function completeAi(candidateToken, applicationId) {
  const started = await json(`/api/applications/${applicationId}/interview`, candidateToken, {
    method: "POST",
    body: JSON.stringify({ questionCount: 3, language: "vi", difficulty: "mid" }),
  });
  const sessionId = started.payload?.session?.id;
  if (!sessionId) return { error: started.payload?.error ?? started.response.status };
  const completed = await json(`/api/interviews/${sessionId}/complete`, candidateToken, {
    method: "POST",
    body: JSON.stringify({ durationSeconds: 60 }),
  });
  return { sessionId, ok: completed.response.ok, error: completed.payload?.error };
}

async function sendReadyOffer(actor, applicationId) {
  const created = await json(`/api/enterprise/applications/${applicationId}/offers`, actor, { method: "POST" });
  const offerId = created.payload?.offer?.id;
  if (!offerId) return { offerId: null, error: created.payload?.error ?? created.response.status };
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
  const sent = await json(`/api/enterprise/offers/${offerId}/send`, actor, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { offerId, sentStatus: sent.payload?.offer?.status, error: sent.payload?.error };
}

async function main() {
  let fails = 0;
  const recruiter = await login("recruiter@nexusai.local", staffPassword());
  const admin = await login("admin@pivotassist.local", staffPassword());
  const nam = await login("nam.nguyen@example.com", candidatePassword());
  const ha = await login("ha.le@example.com", candidatePassword());

  const hiredDirect = await json("/api/enterprise/applications/seed_app_nam_frontend", recruiter, {
    method: "PATCH",
    body: JSON.stringify({ status: "HIRED" }),
  });
  fails += record("PATCH HIRED blocked 409", hiredDirect.response.status === 409, String(hiredDirect.response.status)) ? 0 : 1;

  const namList = await json("/api/applications", nam);
  const hireTarget = (namList.payload?.applications ?? []).find((row) => row.status !== "HIRED" && row.status !== "REJECTED" && row.status !== "WITHDRAWN");
  if (!hireTarget) {
    fails += record("nam has a non-terminal application for this-run accept", false, "none") ? 0 : 1;
  } else {
    const done = await completeAi(nam, hireTarget.id);
    const sent = await sendReadyOffer(admin, hireTarget.id);
    const accept = await json(`/api/applications/${hireTarget.id}/offer`, nam, {
      method: "POST",
      body: JSON.stringify({ decision: "ACCEPTED" }),
    });
    const after = await json(`/api/applications/${hireTarget.id}`, nam);
    const dump = JSON.stringify(after.payload);
    fails += record(
      "this-run SENT→ACCEPTED writes HIRED",
      accept.response.ok && accept.payload?.hired === true && after.payload?.application?.status === "HIRED",
      `app=${hireTarget.id} complete=${done.ok} send=${sent.sentStatus} hired=${accept.payload?.hired} status=${after.payload?.application?.status} err=${done.error ?? sent.error ?? accept.payload?.error ?? ""}`,
    ) ? 0 : 1;
    fails += record("hired DTO omits internalReason/score", !dump.includes("internalReason") && !dump.includes("overallScore")) ? 0 : 1;
  }

  const applied = await json("/api/applications", ha, {
    method: "POST",
    body: JSON.stringify({ jobId: "seed_job_ai" }),
  });
  const declineId = applied.payload?.application?.id;
  if (!applied.response.ok || !declineId) {
    fails += record("ha apply backend for decline fixture", false, applied.payload?.error ?? String(applied.response.status)) ? 0 : 1;
  } else {
    const done = await completeAi(ha, declineId);
    const sent = await sendReadyOffer(admin, declineId);
    const declined = await json(`/api/applications/${declineId}/offer`, ha, {
      method: "POST",
      body: JSON.stringify({ decision: "DECLINED" }),
    });
    const after = await json(`/api/applications/${declineId}`, ha);
    fails += record(
      "this-run SENT→DECLINED is HOLD not HIRED",
      declined.response.ok && after.payload?.application?.status === "HOLD",
      `app=${declineId} complete=${done.ok} send=${sent.sentStatus} status=${after.payload?.application?.status} err=${done.error ?? sent.error ?? declined.payload?.error ?? ""}`,
    ) ? 0 : 1;
  }

  process.exit(fails === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
