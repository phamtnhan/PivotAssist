import { candidatePassword, staffPassword } from "./verify-credentials.mjs";
const BASE = process.env.VERIFY_BASE ?? "http://localhost:3000";

function record(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function login(email, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => null);
  const setCookie = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const cookieLine = setCookie.filter(Boolean).join("\n");
  const token = /pivotassist_session=([^;]+)/.exec(cookieLine)?.[1];
  return { response, payload, cookieLine, token };
}

async function json(path, token, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      cookie: token ? `pivotassist_session=${token}` : "",
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function main() {
  let fails = 0;
  const jobs = await fetch(`${BASE}/jobs`);
  const html = await jobs.text();
  const csp = jobs.headers.get("content-security-policy") ?? "";
  fails += record("GET /jobs 200", jobs.status === 200, String(jobs.status)) ? 0 : 1;
  fails += record("jobs chrome Phòng phỏng vấn", html.includes("Phòng phỏng vấn")) ? 0 : 1;
  fails += record("jobs not loading-only", !html.includes("Đang tải việc làm") || html.includes("Việc làm")) ? 0 : 1;
  fails += record("CSP header", csp.includes("default-src 'self'"), csp.slice(0, 80)) ? 0 : 1;

  const badLogin = await login("nobody@example.invalid", "wrong");
  fails += record("login fail generic 401", badLogin.response.status === 401 && !JSON.stringify(badLogin.payload).includes("details"), String(badLogin.response.status)) ? 0 : 1;

  const candidate = await login("nam.nguyen@example.com", candidatePassword());
  fails += record("login cookie HttpOnly", Boolean(candidate.token) && /httponly/i.test(candidate.cookieLine), `httponly=${/httponly/i.test(candidate.cookieLine)}`) ? 0 : 1;
  fails += record("login cookie SameSite=lax", /samesite=lax/i.test(candidate.cookieLine)) ? 0 : 1;

  const apps = await json("/api/applications", candidate.token);
  const dump = JSON.stringify(apps.payload);
  fails += record("candidate applications omit score/internalReason", apps.response.ok && !dump.includes("internalReason") && !dump.includes("overallScore"), String(apps.response.status)) ? 0 : 1;

  const originDenied = await json("/api/applications/seed_app_nam_frontend/offer", candidate.token, {
    method: "POST",
    headers: { origin: "http://evil.example" },
    body: JSON.stringify({ decision: "DECLINED" }),
  });
  fails += record("offer POST disallowed Origin 403", originDenied.response.status === 403, String(originDenied.response.status)) ? 0 : 1;

  const recruiter = await login("recruiter@nexusai.local", staffPassword());
  const list = await json("/api/enterprise/applications", recruiter.token);
  const listDump = JSON.stringify(list.payload);
  fails += record("enterprise list omits candidatePhone", list.response.ok && !listDump.includes("candidatePhone"), `status=${list.response.status} n=${list.payload?.applications?.length ?? 0}`) ? 0 : 1;

  const demo = await fetch(`${BASE}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "CANDIDATE" }),
  });
  const demoJson = await demo.json().catch(() => ({}));
  fails += record("demo candidate session without password body", demo.ok && demoJson.success === true, String(demo.status)) ? 0 : 1;

  process.exit(fails === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
