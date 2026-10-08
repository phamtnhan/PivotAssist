import { candidatePassword, staffPassword } from "./verify-credentials.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3000";

function log(ok, name, extra) {
  console.log(ok ? "PASS" : "FAIL", name, extra ?? "");
  if (!ok) process.exitCode = 1;
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  const setCookie = response.headers.getSetCookie?.() ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")] : []);
  const nextCookie = setCookie.map((value) => value.split(";")[0]).join("; ") || cookie;
  return { response, payload, cookie: nextCookie };
}

async function login(email, password) {
  return request("/api/auth/login", { method: "POST", body: { email, password } });
}

async function main() {
  const recruiter = await login("recruiter@nexusai.local", staffPassword());
  log(recruiter.payload?.success === true && recruiter.payload?.user?.role === "RECRUITER", "recruiter login", recruiter.payload?.user?.email);

  const jobs = await request("/api/enterprise/jobs", { cookie: recruiter.cookie });
  const ngoc = (jobs.payload?.jobs ?? []).flatMap((job) => job.applications ?? []).find((application) => application.id === "seed_app_ngoc_ai");
  log(Boolean(jobs.payload?.success), "enterprise jobs", { count: jobs.payload?.jobs?.length, titles: (jobs.payload?.jobs ?? []).map((job) => job.title) });
  if (ngoc) {
    const consistent = typeof ngoc.interviewScore === "number" ? ngoc.status === "AI_INTERVIEW_COMPLETED" || ["SHORTLISTED", "FACE_TO_FACE_SCHEDULED", "HIRED"].includes(ngoc.status) : ngoc.status === "AI_INTERVIEW_PENDING" || ngoc.status === "SUBMITTED";
    log(consistent, "ngoc status matches score", { status: ngoc.status, score: ngoc.interviewScore, nextAction: ngoc.nextAction });
  } else {
    log(false, "ngoc application present");
  }

  const junk = (jobs.payload?.jobs ?? []).some((job) => /1111111/.test(job.title));
  log(!junk, "no junk job titles in recruiter ATS");

  const candidate = await login("nam.nguyen@example.com", candidatePassword());
  log(candidate.payload?.success === true, "candidate login");
  const before = await request("/api/profile", { cookie: candidate.cookie });
  const remainingBefore = Number(before.payload?.user?.preferencesJson?.remainingSessions ?? 0);
  const checkout = await request("/api/billing/checkout", { method: "POST", body: { planId: "starter" }, cookie: candidate.cookie });
  log(checkout.payload?.success === true && checkout.payload?.invoice?.status !== undefined, "checkout creates invoice", { status: checkout.payload?.invoice?.status, provider: checkout.payload?.invoice?.provider });
  const after = await request("/api/profile", { cookie: candidate.cookie });
  const remainingAfter = Number(after.payload?.user?.preferencesJson?.remainingSessions ?? 0);
  const shouldStay = checkout.payload?.invoice?.status !== "PAID";
  log(shouldStay ? remainingAfter === remainingBefore : remainingAfter >= remainingBefore, "sessions not granted until paid unless free-local", { remainingBefore, remainingAfter, invoiceStatus: checkout.payload?.invoice?.status });

  const admin = await login("admin@pivotassist.local", staffPassword());
  log(admin.payload?.success === true && admin.payload?.user?.role === "ADMIN", "admin login");
  if (checkout.payload?.invoice?.id && checkout.payload?.invoice?.status !== "PAID") {
    const confirm = await request("/api/admin/billing", { method: "PATCH", body: { invoiceId: checkout.payload.invoice.id, action: "confirm" }, cookie: admin.cookie });
    log(confirm.payload?.success === true && confirm.payload?.invoice?.status === "PAID", "admin confirms invoice", confirm.payload?.invoice?.status);
    const granted = await request("/api/profile", { cookie: candidate.cookie });
    log(Number(granted.payload?.user?.preferencesJson?.remainingSessions ?? 0) >= remainingBefore + 5, "sessions granted after confirm", granted.payload?.user?.preferencesJson?.remainingSessions);
  }

  const setup = await request("/api/auth/2fa/setup", { method: "POST", cookie: candidate.cookie });
  log(setup.payload?.success === true && typeof setup.payload?.secret === "string", "2fa setup returns secret");
  if (setup.payload?.secret) {
    const { totpNow } = await import("./totp-now.mjs");
    const code = totpNow(setup.payload.secret);
    const confirm2fa = await request("/api/auth/2fa/confirm", { method: "POST", body: { code }, cookie: candidate.cookie });
    log(confirm2fa.payload?.success === true, "2fa confirm", confirm2fa.payload?.error ?? confirm2fa.payload?.message);
    const challenged = await login("nam.nguyen@example.com", candidatePassword());
    log(challenged.payload?.requiresTwoFactor === true && Boolean(challenged.payload?.pendingToken), "login requires TOTP after enroll");
    const code2 = totpNow(setup.payload.secret);
    const finish = await request("/api/auth/login/2fa", { method: "POST", body: { pendingToken: challenged.payload.pendingToken, code: code2 } });
    log(finish.payload?.success === true && Boolean(finish.cookie), "login with TOTP", finish.payload?.user?.email);
    const disable = await request("/api/auth/2fa/disable", { method: "POST", body: { password: candidatePassword(), code: totpNow(setup.payload.secret) }, cookie: finish.cookie });
    log(disable.payload?.success === true, "disable 2fa after verify", disable.payload?.error ?? disable.payload?.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
