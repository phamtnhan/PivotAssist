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
  if (!response.ok || !token) throw new Error(`login failed ${email}: ${payload?.error ?? response.status}`);
  return token;
}

function headers(token) {
  return { cookie: `pivotassist_session=${token}`, "content-type": "application/json" };
}

async function json(path, token, init = {}) {
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers(token), ...init.headers } });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function main() {
  const recruiter = await login("recruiter@nexusai.local", staffPassword());
  const candidate = await login("nam.nguyen@example.com", candidatePassword());
  const apps = await json("/api/applications", candidate);
  const hired = (apps.payload?.applications ?? []).find((row) => row.status === "HIRED");
  if (!hired) throw new Error("need hired application from previous slice");

  const accept = await json(`/api/applications/${hired.id}/offer`, candidate, {
    method: "POST",
    body: JSON.stringify({ decision: "ACCEPTED" }),
  });
  console.log("duplicate accept", accept.response.status, accept.payload);

  const fakeId = "cm_not_a_real_application_id";
  const idor = await json(`/api/applications/${fakeId}/offer`, candidate);
  console.log("unknown offer", idor.response.status, idor.payload?.error);

  const reviewsAsCandidate = await json(`/api/enterprise/applications/${hired.id}/reviews`, candidate);
  console.log("candidate reviews", reviewsAsCandidate.response.status);

  const review = await json(`/api/enterprise/applications/${hired.id}/reviews`, recruiter, {
    method: "POST",
    body: JSON.stringify({
      status: "SUBMITTED",
      overallRecommendation: "OFFER",
      strengths: "Giao tiếp rõ",
      concerns: "Cần thêm ví dụ số liệu",
      comment: "Đủ để gửi đề nghị",
      privateNote: "Ghi chú riêng không lộ",
    }),
  });
  console.log("submit review", review.response.status, review.payload?.success, review.payload?.reviews?.[0]?.privateNote ? "private-leaked-in-list" : "private-ok");

  const enterpriseGet = await json(`/api/enterprise/applications/${hired.id}`, recruiter);
  const leakedToCandidateShape = JSON.stringify(enterpriseGet.payload).includes("internalReason");
  console.log("enterprise get has internalReason", leakedToCandidateShape);

  const candidateGet = await json(`/api/applications/${hired.id}`, candidate);
  const leaked = JSON.stringify(candidateGet.payload);
  console.log("candidate get leak", {
    internalReason: leaked.includes("internalReason"),
    privateNote: leaked.includes("Ghi chú riêng"),
    overallScore: leaked.includes("overallScore"),
    modelName: leaked.includes("modelName"),
    facing: candidateGet.payload?.application?.candidateFacing,
    status: candidateGet.payload?.application?.status,
  });

  const jobs = await fetch(`${BASE}/jobs`);
  const html = await jobs.text();
  console.log("jobs ssr", {
    status: jobs.status,
    hasLoading: html.includes("Đang tải việc làm"),
    hasXInterview: html.includes("x-interview") || html.includes("Trưởng phòng") || html.includes("hành chính"),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
