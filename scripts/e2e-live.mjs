import { candidatePassword, staffPassword } from "./verify-credentials.mjs";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";

function cookieHeader(setCookie) {
  if (!setCookie) return "";
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.map((item) => item.split(";")[0]).join("; ");
}

async function jsonReq(path, { method = "GET", cookie = "", body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 300) }; }
  return { status: response.status, payload, cookie: cookieHeader(response.headers.getSetCookie?.() ?? response.headers.get("set-cookie")) };
}

async function login(email, password) {
  const result = await jsonReq("/api/auth/login", { method: "POST", body: { email, password } });
  return result;
}

async function html(path, cookie) {
  const response = await fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  const text = await response.text();
  return { status: response.status, title: (text.match(/<title>([^<]+)<\/title>/i) ?? [])[1] ?? "", hasLoginForm: /type="password"/.test(text), length: text.length };
}

const report = [];
function log(ok, label, extra) {
  const row = { ok, label, extra };
  report.push(row);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`, extra ?? "");
}

const recruiter = await login("recruiter@nexusai.local", staffPassword());
log(recruiter.status === 200 && recruiter.payload?.success === true && recruiter.payload?.user?.role === "RECRUITER", "recruiter login", { status: recruiter.status, role: recruiter.payload?.user?.role, name: recruiter.payload?.user?.fullName });
const recCookie = recruiter.cookie;

const dash = await jsonReq("/api/enterprise/jobs", { cookie: recCookie });
log(dash.status === 200 && dash.payload?.success === true && Array.isArray(dash.payload?.jobs) && dash.payload.jobs.length > 0, "enterprise jobs live", { status: dash.status, count: dash.payload?.jobs?.length, first: dash.payload?.jobs?.[0]?.title, company: dash.payload?.jobs?.[0]?.companyName, dataSourceHint: dash.payload?.jobs?.[0]?.id });

const analytics = await jsonReq("/api/enterprise/analytics", { cookie: recCookie });
log(analytics.status === 200 && analytics.payload?.success === true && analytics.payload?.metrics, "enterprise analytics live", analytics.payload?.metrics);

const apps = await jsonReq("/api/enterprise/applications", { cookie: recCookie });
log(apps.status === 200 && apps.payload?.success === true, "enterprise applications live", { status: apps.status, count: apps.payload?.applications?.length ?? apps.payload?.items?.length });

const candidate = await login("nam.nguyen@example.com", candidatePassword());
log(candidate.status === 200 && candidate.payload?.success === true && candidate.payload?.user?.role === "CANDIDATE", "candidate login", { status: candidate.status, role: candidate.payload?.user?.role, name: candidate.payload?.user?.fullName });
const candCookie = candidate.cookie;

const jobs = await jsonReq("/api/jobs", { cookie: candCookie });
log(jobs.status === 200 && jobs.payload?.success === true && jobs.payload.jobs?.length > 0, "public jobs live", { count: jobs.payload?.jobs?.length, firstCompany: jobs.payload?.jobs?.[0]?.companyName, firstTitle: jobs.payload?.jobs?.[0]?.title });

const resumes = await jsonReq("/api/resumes", { cookie: candCookie });
log(resumes.status === 200 && resumes.payload?.success === true, "candidate resumes", { count: resumes.payload?.resumes?.length, filename: resumes.payload?.resumes?.[0]?.filename });

const candApps = await jsonReq("/api/applications", { cookie: candCookie });
log(candApps.status === 200 && candApps.payload?.success === true, "candidate applications", { count: candApps.payload?.applications?.length, statuses: (candApps.payload?.applications ?? []).map((item) => item.status) });

const profile = await jsonReq("/api/profile", { cookie: candCookie });
log(profile.status === 200 && profile.payload?.success === true, "candidate profile", { email: profile.payload?.user?.email, fullName: profile.payload?.user?.fullName });

const admin = await login("admin@pivotassist.local", staffPassword());
log(admin.status === 200 && admin.payload?.user?.role === "ADMIN", "admin login", { status: admin.status, role: admin.payload?.user?.role });
const adminCookie = admin.cookie;
const overview = await jsonReq("/api/admin/overview", { cookie: adminCookie });
log(overview.status === 200 && overview.payload?.success === true, "admin overview", overview.payload?.metrics);
const users = await jsonReq("/api/admin/users", { cookie: adminCookie });
log(users.status === 200 && users.payload?.users?.length > 0, "admin users live", { count: users.payload?.users?.length, sample: users.payload?.users?.[0]?.email });
const companies = await jsonReq("/api/admin/companies", { cookie: adminCookie });
log(companies.status === 200 && companies.payload?.companies?.length > 0, "admin companies live", { count: companies.payload?.companies?.length, sample: companies.payload?.companies?.[0]?.name });
const interviews = await jsonReq("/api/admin/interviews", { cookie: adminCookie });
log(interviews.status === 200 && Array.isArray(interviews.payload?.interviews), "admin interviews live", { count: interviews.payload?.interviews?.length });

const pages = ["/login", "/jobs", "/home", "/enterprise/dashboard", "/enterprise/analytics", "/admin", "/profiles", "/settings", "/services", "/interview", "/applications"];
for (const path of pages) {
  const cookie = path.startsWith("/enterprise") ? recCookie : path.startsWith("/admin") ? adminCookie : path === "/login" ? "" : candCookie;
  const page = await html(path, cookie);
  log(page.status === 200 && page.length > 500, `page ${path}`, { status: page.status, title: page.title, length: page.length });
}

const badLogin = await login("nobody@example.com", "wrong");
log(badLogin.status === 401 && badLogin.payload?.success === false, "invalid login rejected", { status: badLogin.status, error: badLogin.payload?.error });

const unauthDash = await jsonReq("/api/enterprise/analytics");
log(unauthDash.status === 401 || unauthDash.payload?.success === false, "enterprise analytics requires auth", { status: unauthDash.status, error: unauthDash.payload?.error });

writeFileSync("scripts/.e2e-live-report.json", JSON.stringify(report, null, 2), "utf8");
const failed = report.filter((row) => !row.ok);
console.log(`\n${report.length - failed.length}/${report.length} passed`);
if (failed.length) process.exitCode = 1;
