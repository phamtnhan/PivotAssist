import { candidatePassword, staffPassword } from "./verify-credentials.mjs";
const baseUrl = process.env.PIVOTASSIST_URL || "http://localhost:3000";

async function request(path, options = {}, cookie = "") {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

function cookieFrom(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const first = values[0] || response.headers.get("set-cookie") || "";
  return first.split(";")[0];
}

async function login(email, password) {
  const result = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!result.response.ok || !result.body.success) throw new Error(`Login failed for ${email}: ${result.body.error || result.response.status}`);
  return cookieFrom(result.response);
}

function assertOk(label, result) {
  if (!result.response.ok || !result.body.success) throw new Error(`${label} failed: ${result.body.error || result.response.status}`);
}

const candidateCookie = await login("nam.nguyen@example.com", candidatePassword());
const profile = await request("/api/profile", {}, candidateCookie);
const resumes = await request("/api/resumes", {}, candidateCookie);
const jobs = await request("/api/jobs?pageSize=10", {}, candidateCookie);
const match = await request("/api/matches/seed_job_frontend", {}, candidateCookie);
assertOk("candidate profile", profile);
assertOk("candidate resumes", resumes);
assertOk("public jobs", jobs);
assertOk("job match", match);

const recruiterCookie = await login("recruiter@nexusai.local", staffPassword());
const enterpriseJobs = await request("/api/enterprise/jobs", {}, recruiterCookie);
const analytics = await request("/api/enterprise/analytics", {}, recruiterCookie);
assertOk("enterprise jobs", enterpriseJobs);
assertOk("enterprise analytics", analytics);

const adminCookie = await login("admin@pivotassist.local", staffPassword());
const overview = await request("/api/admin/overview", {}, adminCookie);
const adminUsers = await request("/api/admin/users", {}, adminCookie);
assertOk("admin overview", overview);
assertOk("admin users", adminUsers);

console.log(JSON.stringify({
  baseUrl,
  candidate: { resumes: resumes.body.resumes.length, jobs: jobs.body.jobs.length, match: match.body.score.overallScore },
  enterprise: { jobs: enterpriseJobs.body.total ?? enterpriseJobs.body.jobs.length, applications: analytics.body.metrics.applications },
  admin: { users: overview.body.metrics.users, companies: overview.body.metrics.companies, interviews: overview.body.metrics.interviews },
  status: "PASS",
}, null, 2));
