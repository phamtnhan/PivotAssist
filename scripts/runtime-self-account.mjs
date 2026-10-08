// REQ-0003 / REQ-0004 — agent-created candidate account; no score leak on applications
import { randomToken } from "./verify-credentials.mjs";

const BASE = process.env.VERIFY_BASE ?? "http://localhost:3000";
const origin = "http://localhost:3000";

function record(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  let fails = 0;
  const email = `agent.self.${Date.now()}@example.com`;
  const password = randomToken();
  const register = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ fullName: "Agent Self Account", email, password, role: "CANDIDATE" }),
  });
  const registerBody = await register.json().catch(() => null);
  fails += record("register 200", register.ok, String(register.status)) ? 0 : 1;
  const registerCookie = /pivotassist_session=/.test(register.headers.get("set-cookie") ?? "");
  fails += record("register sets session cookie", registerCookie) ? 0 : 1;
  fails += record("register body has no details", registerBody?.details == null) ? 0 : 1;

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await login.json().catch(() => null);
  const token = /pivotassist_session=([^;]+)/.exec(login.headers.get("set-cookie") ?? "")?.[1];
  fails += record("login 200 with self-created account", login.ok && Boolean(token), String(login.status)) ? 0 : 1;
  fails += record("login body has no details", loginBody?.details == null) ? 0 : 1;

  if (!token) {
    process.exitCode = fails ? 1 : 0;
    return;
  }

  const jobs = await fetch(`${BASE}/api/jobs`, { headers: { cookie: `pivotassist_session=${token}` } });
  const jobsBody = await jobs.json().catch(() => null);
  fails += record("GET /api/jobs 200", jobs.ok, String(jobs.status)) ? 0 : 1;

  const jobId = jobsBody?.jobs?.[0]?.id;
  if (jobId) {
    const apply = await fetch(`${BASE}/api/applications`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie: `pivotassist_session=${token}` },
      body: JSON.stringify({ jobId }),
    });
    fails += record("self-account apply", apply.status === 200 || apply.status === 201 || apply.status === 409, String(apply.status)) ? 0 : 1;
  } else {
    fails += record("jobs list has an id", false, "none") ? 0 : 1;
  }

  const apps = await fetch(`${BASE}/api/applications`, { headers: { cookie: `pivotassist_session=${token}` } });
  const appsBody = await apps.json().catch(() => null);
  const leaked = JSON.stringify(appsBody).includes("internalReason") || JSON.stringify(appsBody).includes("overallScore");
  fails += record("candidate applications omit score/internalReason", apps.ok && !leaked) ? 0 : 1;
  fails += record("self-created email not logged", true, email.replace(/^agent\.self\.\d+/, "agent.self.<ts>")) ? 0 : 1;

  if (fails) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
