import { candidatePassword, staffPassword } from "./verify-credentials.mjs";
const BASE = process.env.VERIFY_BASE ?? "http://127.0.0.1:3000";

async function login(email, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => null);
  const cookie = response.headers.get("set-cookie") ?? "";
  const token = /pivotassist_session=([^;]+)/.exec(cookie)?.[1];
  if (!response.ok || !token) throw new Error(`login failed ${email}: ${payload?.error ?? response.status}`);
  return token;
}

function headers(token, extra = {}) {
  return { cookie: `pivotassist_session=${token}`, "content-type": "application/json", ...extra };
}

async function json(path, token, init = {}) {
  const response = await fetch(`${BASE}${path}`, { ...init, headers: headers(token, init.headers) });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const recruiter = await login("recruiter@nexusai.local", staffPassword());
  const candidate = await login("nam.nguyen@example.com", candidatePassword());
  const other = await login("admin@pivotassist.local", staffPassword());

  const apps = await json("/api/applications", candidate);
  const application = (apps.payload?.applications ?? []).find((row) => row.status === "AI_INTERVIEW_COMPLETED" || row.interviews?.length)
    ?? apps.payload?.applications?.[0];
  if (!application) throw new Error("no candidate application");
  record("candidate list omits scores", !JSON.stringify(apps.payload).includes("overallScore") && !JSON.stringify(apps.payload).includes("internalReason"), `app=${application.id}`);

  const leak = await json(`/api/enterprise/applications/${application.id}`, candidate);
  record("candidate cannot read enterprise application", leak.response.status === 401 || leak.response.status === 403, String(leak.response.status));

  const otherApp = await json(`/api/applications/${application.id}`, other);
  record("other role cannot take candidate application as owner", otherApp.response.status === 401 || otherApp.response.status === 403 || otherApp.response.status === 404 || otherApp.payload?.application?.id !== application.id, String(otherApp.response.status));

  const report = await json(`/api/interviews/${application.interviews?.[0]?.id ?? "missing"}/report`, candidate);
  const reportText = JSON.stringify(report.payload ?? {});
  record("candidate report hides internal score", report.payload?.audience === "candidate" && !reportText.includes("modelName") && report.payload?.report?.score == null, report.payload?.audience ?? String(report.response.status));

  const hiredDirect = await json(`/api/enterprise/applications/${application.id}`, recruiter, {
    method: "PATCH",
    body: JSON.stringify({ status: "HIRED" }),
  });
  record("direct HIRED blocked", hiredDirect.response.status === 409, hiredDirect.payload?.error);

  const next = await json(`/api/enterprise/applications/${application.id}`, recruiter, {
    method: "PATCH",
    body: JSON.stringify({ action: "NEXT_INTERVIEW" }),
  });
  record("NEXT_INTERVIEW", next.response.ok && next.payload?.application?.status === "SHORTLISTED", next.payload?.error ?? next.payload?.application?.status);

  const nextAgain = await json(`/api/enterprise/applications/${application.id}`, recruiter, {
    method: "PATCH",
    headers: { "idempotency-key": "NEXT_INTERVIEW:repeat-test" },
    body: JSON.stringify({ action: "NEXT_INTERVIEW", idempotencyKey: "NEXT_INTERVIEW:repeat-test" }),
  });
  record("duplicate decision idempotent", nextAgain.response.ok, nextAgain.payload?.error);

  const offer = await json(`/api/enterprise/applications/${application.id}/offers`, recruiter, { method: "POST" });
  record("PROCEED_TO_OFFER creates draft", offer.response.ok && offer.payload?.offer?.status === "DRAFT", offer.payload?.error ?? offer.payload?.offer?.status);

  const hidden = await json(`/api/applications/${application.id}/offer`, candidate);
  record("draft offer hidden from candidate", hidden.payload?.offer == null, hidden.payload?.offer?.status);

  const offerId = offer.payload?.offer?.id;
  if (offerId) {
    const saved = await json(`/api/enterprise/offers/${offerId}`, recruiter, {
      method: "PATCH",
      body: JSON.stringify({ compensationAmount: 25_000_000, currency: "VND", terms: "Thử việc 2 tháng" }),
    });
    record("offer compensation integer", saved.response.ok && saved.payload?.offer?.compensationAmount === 25_000_000, saved.payload?.error);

    const me = await json("/api/auth/me", recruiter);
    const approverId = me.payload?.user?.userId;
    const requested = await json(`/api/enterprise/offers/${offerId}/approvals`, recruiter, {
      method: "POST",
      body: JSON.stringify({ approverIds: [approverId], sequential: true }),
    });
    record("approval requested", requested.response.ok, requested.payload?.error);

    const approved = await json(`/api/enterprise/offers/${offerId}/approvals`, recruiter, {
      method: "POST",
      body: JSON.stringify({ decision: "APPROVED" }),
    });
    record("approval approved", approved.response.ok && approved.payload?.offer?.status === "APPROVED", approved.payload?.error ?? approved.payload?.offer?.status);

    const sent = await json(`/api/enterprise/offers/${offerId}/send`, recruiter, { method: "POST", body: "{}" });
    record("offer sent", sent.response.ok && sent.payload?.offer?.status === "SENT", sent.payload?.error ?? sent.payload?.offer?.status);

    const visible = await json(`/api/applications/${application.id}/offer`, candidate);
    record("candidate sees sent offer", visible.payload?.offer?.status === "SENT" && visible.payload?.offer?.compensationAmount === 25_000_000, visible.payload?.offer?.status);

    const accept1 = await json(`/api/applications/${application.id}/offer`, candidate, {
      method: "POST",
      body: JSON.stringify({ decision: "ACCEPTED" }),
    });
    const accept2 = await json(`/api/applications/${application.id}/offer`, candidate, {
      method: "POST",
      body: JSON.stringify({ decision: "ACCEPTED" }),
    });
    record("accept then hired", accept1.response.ok && accept1.payload?.hired === true, accept1.payload?.error);
    record("duplicate accept idempotent", accept2.response.ok && accept2.payload?.already === true, accept2.payload?.error);
  }

  const rejectRace = await Promise.all([
    json(`/api/enterprise/applications/${application.id}`, recruiter, {
      method: "PATCH",
      body: JSON.stringify({ action: "REJECT", internalReason: "late" }),
    }),
    json(`/api/enterprise/applications/${application.id}`, recruiter, {
      method: "PATCH",
      body: JSON.stringify({ action: "PROCEED_TO_OFFER" }),
    }),
  ]);
  const rejectOk = rejectRace.some((item) => item.response.status === 409 || item.payload?.already || !item.response.ok);
  record("post-hired reject/proceed blocked", rejectOk, rejectRace.map((item) => item.response.status).join("/"));

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ passed: results.filter((item) => item.ok).length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
