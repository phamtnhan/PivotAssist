import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../packages/db/dist/index.js";
import { evaluateInterview, matchResumeToJob, parseResumeText } from "../packages/free-ai/dist/index.js";
import { ensureVerifyPasswords, VERIFY_EMAILS } from "./verify-credentials.mjs";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // The caller may already have supplied DATABASE_URL.
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const skills = [
  ["TypeScript", "Programming", "HARD"], ["JavaScript", "Programming", "HARD"], ["React", "Frontend", "HARD"],
  ["Next.js", "Frontend", "HARD"], ["Node.js", "Backend", "HARD"], ["Go", "Backend", "HARD"], ["Python", "Backend", "HARD"],
  ["FastAPI", "Backend", "HARD"], ["PostgreSQL", "Data", "HARD"], ["MySQL", "Data", "HARD"], ["Redis", "Data", "TOOL"],
  ["Kafka", "Messaging", "TOOL"], ["REST", "API", "HARD"], ["GraphQL", "API", "HARD"], ["WebRTC", "Realtime", "HARD"],
  ["Docker", "DevOps", "TOOL"], ["Kubernetes", "DevOps", "TOOL"], ["CI/CD", "DevOps", "TOOL"], ["Playwright", "Testing", "TOOL"],
  ["Jest", "Testing", "TOOL"], ["System Design", "Architecture", "HARD"], ["Microservices", "Architecture", "HARD"],
  ["LLM", "AI", "DOMAIN"], ["RAG", "AI", "DOMAIN"], ["Embeddings", "AI", "DOMAIN"], ["Prompt Engineering", "AI", "HARD"],
  ["Cloudflare", "Infrastructure", "TOOL"], ["R2", "Storage", "TOOL"], ["Leadership", "Soft skills", "SOFT"], ["Communication", "Soft skills", "SOFT"],
];

const jobSeeds = [
  {
    id: "seed_job_demo_interview",
    companyId: "seed_company_nexus",
    title: "Demo AI Interview - Senior Frontend Engineer",
    department: "Product Engineering",
    location: "TP. Hồ Chí Minh · Hybrid",
    salaryRange: "35–55 triệu VND",
    descriptionRaw: "Vị trí demo để trình bày PivotAssist. Ứng viên cần có kinh nghiệm React, Next.js, TypeScript, tối ưu hiệu năng web, xử lý sự cố và giải thích trade-off kỹ thuật rõ ràng.",
    rubricJson: [
      { label: "Frontend architecture", weight: 30, description: "Thiết kế module, boundary và trade-off." },
      { label: "Performance", weight: 25, description: "Đo lường và cải thiện tốc độ web." },
      { label: "Problem solving", weight: 20, description: "Phân tích vấn đề có cấu trúc và bằng chứng." },
      { label: "Communication", weight: 15, description: "Trình bày quyết định kỹ thuật rõ ràng." },
      { label: "Delivery ownership", weight: 10, description: "Theo sát từ build, test đến release." },
    ],
    questions: [
      "Hãy giới thiệu ngắn gọn một dự án React hoặc Next.js gần đây nhất của bạn và kết quả cụ thể.",
      "Nếu trang Next.js có lượng truy cập tăng mạnh, bạn sẽ kiểm tra và cải thiện hiệu năng theo những bước nào?",
      "Hãy kể một sự cố kỹ thuật bạn từng xử lý. Bạn phát hiện nguyên nhân, khắc phục và phòng ngừa lặp lại ra sao?",
      "Khi Product và Engineering bất đồng về một quyết định kỹ thuật, bạn sẽ dùng dữ liệu nào để đưa ra lựa chọn?",
      "Nếu phải bàn giao sản phẩm vào ngày mai nhưng phát hiện bản build hiện tại chưa ổn định, bạn sẽ chuẩn bị phương án demo và rollback thế nào?",
    ],
  },
  {
    id: "seed_job_frontend",
    companyId: "seed_company_nexus",
    title: "Senior Frontend Engineer",
    department: "Product Engineering",
    location: "TP. Hồ Chí Minh · Hybrid",
    salaryRange: "35–55 triệu VND",
    descriptionRaw: "Thiết kế và phát triển trải nghiệm web traffic lớn bằng React, Next.js và TypeScript. Tối ưu Core Web Vitals, frontend architecture và chất lượng release. Phối hợp với Product, Design và Backend để bàn giao sản phẩm có thể đo lường.",
    rubricJson: [
      { label: "Frontend architecture", weight: 30, description: "Boundaries, trade-off và khả năng mở rộng." },
      { label: "Performance", weight: 25, description: "Đo lường và cải thiện Web Vitals." },
      { label: "Problem solving", weight: 20, description: "Suy luận có cấu trúc và evidence." },
      { label: "Communication", weight: 15, description: "Diễn đạt quyết định kỹ thuật." },
      { label: "Delivery ownership", weight: 10, description: "Theo sát từ build đến production." },
    ],
    questions: [
      "Hãy giới thiệu dự án frontend gần đây nhất và kết quả bạn tạo ra.",
      "Bạn sẽ chẩn đoán và cải thiện Core Web Vitals cho ứng dụng Next.js traffic lớn như thế nào?",
      "Hãy kể một tình huống STAR khi bạn phải thay đổi kiến trúc mà không gián đoạn người dùng.",
      "Bạn xử lý bất đồng kỹ thuật với Product hoặc Tech Lead như thế nào?",
    ],
  },
  {
    id: "seed_job_backend",
    companyId: "seed_company_vanguard",
    title: "Senior Backend Engineer (Golang)",
    department: "Platform & Infrastructure",
    location: "Hà Nội · Remote-first",
    salaryRange: "42–68 triệu VND",
    descriptionRaw: "Xây dựng service nền tảng có độ tin cậy cao cho payment và dữ liệu nội bộ. Thiết kế API, event-driven workflow, PostgreSQL, Redis, Kafka và observability cho nhiều team sản phẩm.",
    rubricJson: [
      { label: "Distributed systems", weight: 30, description: "Consistency, resilience và scale." },
      { label: "Golang & API design", weight: 25, description: "Code quality và interface boundaries." },
      { label: "Reliability", weight: 20, description: "Observability, incident và recovery." },
      { label: "Problem solving", weight: 15, description: "Quyết định dưới áp lực." },
      { label: "Collaboration", weight: 10, description: "Làm việc cross-functional." },
    ],
    questions: [
      "Hãy mô tả một backend system bạn đã đưa vào production.",
      "Bạn thiết kế consistency và failure recovery cho payment service như thế nào?",
      "Hãy kể một incident khó và cách bạn dùng observability để xử lý.",
    ],
  },
  {
    id: "seed_job_ai",
    companyId: "seed_company_nexus",
    title: "AI Solutions Architect",
    department: "Applied Intelligence",
    location: "Đà Nẵng · Hybrid",
    salaryRange: "45–72 triệu VND",
    descriptionRaw: "Thiết kế sản phẩm AI có thể đưa vào vận hành. Kết nối model, data và product constraints thành kiến trúc an toàn; xây dựng evaluation cho LLM/RAG, latency, chi phí và rủi ro dữ liệu.",
    rubricJson: [
      { label: "AI system design", weight: 30, description: "Model, data và serving architecture." },
      { label: "Evaluation & safety", weight: 25, description: "Đo chất lượng và kiểm soát rủi ro." },
      { label: "Product reasoning", weight: 20, description: "Chọn giải pháp theo outcome." },
      { label: "Communication", weight: 15, description: "Giải thích trade-off rõ ràng." },
      { label: "Delivery", weight: 10, description: "Đưa prototype vào vận hành." },
    ],
    questions: [
      "Bạn sẽ thiết kế một RAG system an toàn cho dữ liệu doanh nghiệp như thế nào?",
      "Bạn xây dựng evaluation dataset và metric cho LLM workflow ra sao?",
      "Hãy kể một lần bạn cân bằng chất lượng model, latency và chi phí.",
    ],
  },
];

async function seedUsers() {
  const { candidate, staff } = ensureVerifyPasswords();
  const requireFromWeb = createRequire(path.join(root, "apps", "web", "package.json"));
  const bcrypt = requireFromWeb("bcryptjs");
  const hashes = {
    admin: await bcrypt.hash(staff, 10),
    candidate: await bcrypt.hash(candidate, 10),
  };
  const users = [
    { id: "seed_admin", email: VERIFY_EMAILS.admin, fullName: "PivotAssist Admin", role: "ADMIN", hash: hashes.admin, title: "Platform Administrator" },
    { id: "seed_recruiter_nexus", email: VERIFY_EMAILS.recruiter, fullName: "Phạm Thành Nhân", role: "RECRUITER", hash: hashes.admin, title: "Talent Partner" },
    { id: "seed_nam", email: VERIFY_EMAILS.nam, fullName: "Nguyễn Thành Nam", role: "CANDIDATE", hash: hashes.candidate, title: "Senior Frontend Engineer" },
    { id: "seed_quang", email: VERIFY_EMAILS.quang, fullName: "Trần Minh Quang", role: "CANDIDATE", hash: hashes.candidate, title: "Senior Backend Engineer" },
    { id: "seed_ha", email: VERIFY_EMAILS.ha, fullName: "Lê Thu Hà", role: "CANDIDATE", hash: hashes.candidate, title: "QA Automation Lead" },
    { id: "seed_ngoc", email: VERIFY_EMAILS.ngoc, fullName: "Vũ Bảo Ngọc", role: "CANDIDATE", hash: hashes.candidate, title: "AI Product Engineer" },
  ];
  const result = {};
  for (const user of users) {
    result[user.id] = await prisma.user.upsert({
      where: { email: user.email },
      create: { id: user.id, email: user.email, fullName: user.fullName, passwordHash: user.hash, role: user.role, isActive: true, profile: { create: { currentJobTitle: user.title, targetJobTitle: user.title, yearsOfExperience: user.role === "CANDIDATE" ? 4 : 0, preferredLanguage: "vi", currency: "VND" } } },
      update: { fullName: user.fullName, passwordHash: user.hash, role: user.role, isActive: true, profile: { upsert: { create: { currentJobTitle: user.title, targetJobTitle: user.title, preferredLanguage: "vi", currency: "VND" }, update: { currentJobTitle: user.title } } } },
    });
  }
  return result;
}

async function seedCompanies() {
  const companies = [
    { id: "seed_company_nexus", name: "NexusAI Technologies", taxId: "0109904638", websiteUrl: "https://nexusai.local", businessModel: "In-house HR", notificationEmail: "recruiter@nexusai.local", verificationStatus: "VERIFIED", maxJobs: 10 },
    { id: "seed_company_vanguard", name: "Vanguard Fintech Group", taxId: "0314892014", websiteUrl: "https://vanguard.local", businessModel: "In-house HR", notificationEmail: "recruiter@nexusai.local", verificationStatus: "PENDING", maxJobs: 5 },
  ];
  for (const company of companies) await prisma.company.upsert({ where: { id: company.id }, create: company, update: company });
  await prisma.companyMember.upsert({ where: { companyId_userId: { companyId: "seed_company_nexus", userId: "seed_recruiter_nexus" } }, create: { companyId: "seed_company_nexus", userId: "seed_recruiter_nexus", role: "OWNER" }, update: { role: "OWNER" } });
}

async function seedSkills() {
  const result = {};
  for (const [name, category, type] of skills) result[name] = await prisma.skill.upsert({ where: { name }, create: { name, category, type }, update: { category, type } });
  return result;
}

async function seedJobs(skillMap) {
  for (const seed of jobSeeds) {
    await prisma.job.upsert({ where: { id: seed.id }, create: { id: seed.id, companyId: seed.companyId, title: seed.title, department: seed.department, location: seed.location, employmentType: "FULL_TIME", salaryRange: seed.salaryRange, descriptionRaw: seed.descriptionRaw, isPublished: true, hiringCount: 1, rubricJson: seed.rubricJson, interviewQuestionsJson: seed.questions }, update: { companyId: seed.companyId, title: seed.title, department: seed.department, location: seed.location, salaryRange: seed.salaryRange, descriptionRaw: seed.descriptionRaw, rubricJson: seed.rubricJson, interviewQuestionsJson: seed.questions, isPublished: true, archivedAt: null } });
    for (const [name, skill] of Object.entries(skillMap)) if (seed.descriptionRaw.toLowerCase().includes(name.toLowerCase()) || seed.title.toLowerCase().includes(name.toLowerCase())) await prisma.jobSkill.upsert({ where: { jobId_skillId: { jobId: seed.id, skillId: skill.id } }, create: { jobId: seed.id, skillId: skill.id, isRequired: true }, update: { isRequired: true } });
  }
}

const RESUME_TEXTS = {
  seed_nam: `# Nguyễn Thành Nam
Senior Frontend Engineer
nam.nguyen@example.com | TP. Hồ Chí Minh | 0912 345 678

## Summary
Frontend engineer với 5 năm kinh nghiệm xây dựng sản phẩm web production bằng React, Next.js và TypeScript. Mạnh về frontend architecture, Core Web Vitals, design system và phối hợp cross-functional.

## Experience
### Senior Frontend Engineer — VNG Corporation (03/2022 - hiện tại)
- Chủ trì migrate ứng dụng sang Next.js App Router, giảm FCP 45% và cải thiện conversion 12%.
- Xây dựng design system dùng chung cho 4 product team và triển khai CI/CD bằng Docker.
- Thiết kế REST/GraphQL API integration, viết unit test với Jest và E2E test với Playwright.
### Frontend Developer — FPT Software (06/2019 - 02/2022)
- Phát triển nền tảng B2B với React, Redux và TypeScript cho hơn 100.000 người dùng.
- Phối hợp với Product, Design và Backend để xử lý performance bottleneck.

## Skills
React, Next.js, TypeScript, JavaScript, Node.js, REST, GraphQL, Tailwind CSS, Web Performance, Core Web Vitals, Docker, CI/CD, Jest, Playwright, System Design, WebRTC.

## Education
Đại học Bách Khoa TP. HCM — Kỹ thuật phần mềm (2014 - 2019)
`,
  seed_quang: `# Trần Minh Quang
Senior Backend Engineer
quang.tran@example.com | Hà Nội | 0908 221 144

## Summary
Backend engineer với 6 năm kinh nghiệm xây dựng hệ thống phân tán, API có độ tin cậy cao và event-driven workflows. Có kinh nghiệm Golang, Node.js, PostgreSQL, Redis và observability.

## Experience
### Senior Backend Engineer — Vanguard Fintech (01/2021 - hiện tại)
- Thiết kế Golang microservices cho payment platform, xử lý 2.000 request/second với p95 latency dưới 180ms.
- Xây dựng Kafka event pipeline và Redis cache, giảm chi phí database 35%.
- Thiết lập Docker, Kubernetes, CI/CD, metrics, tracing và quy trình incident response.
### Backend Developer — TechBase (07/2018 - 12/2020)
- Xây dựng REST API bằng Go và Node.js, thiết kế schema MySQL/PostgreSQL.
- Tối ưu query SQL, viết integration test và tài liệu API cho nhiều team.

## Skills
Go, Golang, Node.js, TypeScript, PostgreSQL, MySQL, Redis, Kafka, REST, GraphQL, Docker, Kubernetes, CI/CD, AWS, System Design, Microservices, Event-driven architecture, GitHub Actions.

## Education
Đại học Công nghệ — Khoa học máy tính (2014 - 2018)
`,
  seed_ha: `# Lê Thu Hà
QA Automation Lead
ha.le@example.com | Hà Nội | 0987 554 321

## Summary
QA automation lead với 7 năm kinh nghiệm kiểm thử web và API cho sản phẩm SaaS, xây dựng test strategy và dẫn dắt nhóm QA. Mạnh về quality engineering, CI/CD và phân tích nguyên nhân lỗi.

## Experience
### QA Automation Lead — Katalon Quality Lab (02/2020 - hiện tại)
- Xây dựng framework automation với Playwright, Cypress và JavaScript, giảm regression cycle từ 5 ngày xuống 2 ngày.
- Thiết lập quality gate trong CI/CD, theo dõi defect trend và phối hợp developer xử lý production incident.
- Dẫn dắt 6 QA engineers, chuẩn hóa test plan, API testing và release checklist.
### QA Engineer — BlueCloud (08/2017 - 01/2020)
- Kiểm thử REST API, SQL query, browser compatibility và user acceptance.
- Viết báo cáo lỗi có reproduction steps, impact và evidence rõ ràng.

## Skills
QA, Quality Assurance, Playwright, Cypress, Jest, JavaScript, TypeScript, REST, API testing, SQL, PostgreSQL, CI/CD, Docker, Agile, Leadership, Communication, Root cause analysis.

## Education
Đại học Kinh tế Kỹ thuật — Hệ thống thông tin (2013 - 2017)
`,
  seed_ngoc: `# Vũ Bảo Ngọc
AI Product Engineer
ngoc.vu@example.com | Đà Nẵng | 0933 771 880

## Summary
Product engineer với 4 năm kinh nghiệm kết nối product, data và engineering để đưa tính năng AI vào sử dụng thật. Có nền tảng Python, FastAPI, LLM/RAG, prompt evaluation và React.

## Experience
### AI Product Engineer — Cognitive Cloud (04/2022 - hiện tại)
- Xây dựng RAG assistant bằng Python, FastAPI, PostgreSQL, Redis và embeddings, giảm thời gian tìm tài liệu 60%.
- Thiết kế evaluation dataset, prompt versioning và human review loop cho chatbot doanh nghiệp.
- Phát triển dashboard React/Next.js, tích hợp API và triển khai Cloudflare Workers/R2.
### Software Engineer — OpenProduct (07/2020 - 03/2022)
- Xây dựng React application, Node.js API và hệ thống analytics cho sản phẩm B2B.

## Skills
Python, FastAPI, LLM, RAG, Embeddings, Prompt Engineering, Machine Learning, PostgreSQL, Redis, React, Next.js, TypeScript, Node.js, Cloudflare, R2, REST, System Design, Product thinking, Communication.

## Education
Đại học Bách Khoa Đà Nẵng — Kỹ thuật máy tính (2016 - 2020)
`,
};

async function seedResumes(userMap) {
  const resumeSeeds = [
    ["seed_nam", "Nguyen_Thanh_Nam_Senior_Frontend.md"],
    ["seed_quang", "Tran_Minh_Quang_Backend.md"],
    ["seed_ha", "Le_Thu_Ha_QA_Lead.md"],
    ["seed_ngoc", "Vu_Bao_Ngoc_AI_Product.md"],
  ];
  const result = {};
  for (const [userId, filename] of resumeSeeds) {
    const text = RESUME_TEXTS[userId];
    const parsed = parseResumeText(text, filename);
    const existing = await prisma.resume.findFirst({ where: { userId, fileAsset: { filename } }, select: { id: true, fileAssetId: true } });
    const asset = existing
      ? await prisma.fileAsset.update({ where: { id: existing.fileAssetId }, data: { filename, mimeType: "text/markdown", fileSizeBytes: BigInt(Buffer.byteLength(text)), fileKey: `sample:${filename}` } })
      : await prisma.fileAsset.create({ data: { userId, filename, mimeType: "text/markdown", fileSizeBytes: BigInt(Buffer.byteLength(text)), fileKey: `sample:${filename}`, purpose: "RESUME_PDF" } });
    const resume = existing
      ? await prisma.resume.update({ where: { id: existing.id }, data: { fileAssetId: asset.id, parsedText: text, rawJson: parsed, isActive: true } })
      : await prisma.resume.create({ data: { userId, fileAssetId: asset.id, parsedText: text, rawJson: parsed, isActive: true } });
    for (const name of parsed.extractedSkills) {
      const skill = await prisma.skill.upsert({ where: { name }, create: { name, category: "CV_PARSED", type: "HARD" }, update: {} });
      await prisma.userSkill.upsert({ where: { userId_skillId: { userId, skillId: skill.id } }, create: { userId, skillId: skill.id, status: "PROFICIENT", levelScore: 80 }, update: { status: "PROFICIENT" } });
    }
    result[userId] = resume;
  }
  return result;
}

async function seedInterview({ id, userId, job, applicationId, resume, status = "COMPLETED", scoreSeed = 0 }) {
  const existing = await prisma.interviewSession.upsert({ where: { id }, create: { id, userId, jobId: job.id, applicationId, targetRole: job.title, difficulty: "senior", status, livekitRoomName: `seed_room_${id}`, isVoiceOnly: true, startedAt: new Date(Date.now() - 45 * 60 * 1000), endedAt: status === "COMPLETED" ? new Date(Date.now() - 25 * 60 * 1000) : null, durationSeconds: status === "COMPLETED" ? 1200 : 0, contextJson: { provider: "free-heuristic-v1", jobId: job.id, resumeId: resume.id } }, update: { userId, jobId: job.id, applicationId, targetRole: job.title, status, contextJson: { provider: "free-heuristic-v1", jobId: job.id, resumeId: resume.id } } });
  const questions = job.interviewQuestionsJson ?? [];
  const questionRows = [];
  for (let index = 0; index < questions.length; index += 1) {
    const question = await prisma.interviewQuestion.upsert({ where: { id: `seed_q_${id}_${index + 1}` }, create: { id: `seed_q_${id}_${index + 1}`, sessionId: id, orderIndex: index + 1, category: index === 2 ? "system_design" : index === 1 ? "technical" : "behavioral", prompt: questions[index], askedElapsedMs: index * 180000, answeredElapsedMs: index * 180000 + 120000, keyTakeawaysJson: [] }, update: { prompt: questions[index], orderIndex: index + 1 } });
    questionRows.push(question);
    if (status === "COMPLETED") await prisma.transcriptSegment.upsert({ where: { id: `seed_t_${id}_${index + 1}` }, create: { id: `seed_t_${id}_${index + 1}`, sessionId: id, questionId: question.id, speaker: "candidate", text: `Trong dự án thực tế, tôi đã phân tích bối cảnh, xác định mục tiêu, triển khai giải pháp bằng ${job.title} và đo kết quả bằng metric cụ thể. Tôi phối hợp với team để xử lý trade-off và cải thiện kết quả sau release.`, startElapsedMs: index * 180000 + 10000, endElapsedMs: index * 180000 + 110000 }, update: {} });
  }
  if (status === "COMPLETED") {
    const transcripts = await prisma.transcriptSegment.findMany({ where: { sessionId: id }, orderBy: { startElapsedMs: "asc" } });
    const events = [{ type: "GAZE_AWAY_START", severity: "info" }, { type: "FACE_TOUCH", severity: "warning" }];
    for (let index = 0; index < events.length; index += 1) await prisma.visualEventLog.upsert({ where: { id: `seed_v_${id}_${index + 1}` }, create: { id: `seed_v_${id}_${index + 1}`, sessionId: id, seq: index + 1, elapsedMs: 120000 + index * 20000, type: events[index].type, label: events[index].type, description: "Sample visual event phục vụ kiểm thử report.", severity: events[index].severity }, update: {} });
    const evaluation = evaluateInterview({ jobTitle: job.title, jobDescription: job.descriptionRaw, resumeText: resume.parsedText, rubric: job.rubricJson ?? [], questions: questionRows.map((q) => ({ id: q.id, prompt: q.prompt, category: q.category })), transcripts: transcripts.map((t) => ({ questionId: t.questionId, speaker: t.speaker, text: t.text })), visualEvents: events });
    await prisma.interviewScore.upsert({ where: { sessionId: id }, create: { sessionId: id, overallScore: Math.max(scoreSeed, evaluation.overallScore), starOverallScore: evaluation.starOverallScore, technicalScore: evaluation.technicalScore, visualScore: evaluation.visualScore, strengthsJson: evaluation.strengths, improvementsJson: evaluation.improvements, evaluationStatus: "READY", modelName: "free-heuristic-v1", rubricJson: job.rubricJson ?? [] }, update: { overallScore: Math.max(scoreSeed, evaluation.overallScore), starOverallScore: evaluation.starOverallScore, technicalScore: evaluation.technicalScore, visualScore: evaluation.visualScore, strengthsJson: evaluation.strengths, improvementsJson: evaluation.improvements, evaluationStatus: "READY", modelName: "free-heuristic-v1", rubricJson: job.rubricJson ?? [] } });
    await prisma.visualSummary.upsert({ where: { sessionId: id }, create: { sessionId: id, overallScore: evaluation.visualSummary.overallScore, cameraGazeScore: evaluation.visualSummary.cameraGazeScore, headFramingScore: evaluation.visualSummary.headFramingScore, facialActivityScore: evaluation.visualSummary.facialActivityScore, stabilityScore: evaluation.visualSummary.stabilityScore, videoQualityScore: evaluation.visualSummary.videoQualityScore, totalBlinks: 0, blinkFreqPerMin: 0, gazeAwayCount: evaluation.visualSummary.gazeAwayCount, faceTouchCount: evaluation.visualSummary.faceTouchCount, coachingSummaryJson: evaluation.visualSummary.coachingSummary }, update: { overallScore: evaluation.visualSummary.overallScore, cameraGazeScore: evaluation.visualSummary.cameraGazeScore, headFramingScore: evaluation.visualSummary.headFramingScore, facialActivityScore: evaluation.visualSummary.facialActivityScore, stabilityScore: evaluation.visualSummary.stabilityScore, videoQualityScore: evaluation.visualSummary.videoQualityScore, gazeAwayCount: evaluation.visualSummary.gazeAwayCount, faceTouchCount: evaluation.visualSummary.faceTouchCount, coachingSummaryJson: evaluation.visualSummary.coachingSummary } });
  }
  return existing;
}

async function seedApplications(userMap, resumeMap) {
  const jobs = Object.fromEntries(await Promise.all(jobSeeds.map(async (seed) => [seed.id, await prisma.job.findUniqueOrThrow({ where: { id: seed.id } })])));
  const applicationSeeds = [
    { id: "seed_app_demo_interview", userId: "seed_nam", jobId: "seed_job_demo_interview", resumeId: resumeMap.seed_nam.id, status: "SUBMITTED", sessionId: null, score: 0 },
    { id: "seed_app_nam_frontend", userId: "seed_nam", jobId: "seed_job_frontend", resumeId: resumeMap.seed_nam.id, status: "AI_INTERVIEW_COMPLETED", sessionId: "seed_session_nam_frontend", score: 91 },
    { id: "seed_app_quang_backend", userId: "seed_quang", jobId: "seed_job_backend", resumeId: resumeMap.seed_quang.id, status: "AI_INTERVIEW_COMPLETED", sessionId: "seed_session_quang_backend", score: 88 },
    { id: "seed_app_ha_frontend", userId: "seed_ha", jobId: "seed_job_frontend", resumeId: resumeMap.seed_ha.id, status: "FACE_TO_FACE_SCHEDULED", sessionId: "seed_session_ha_frontend", score: 84 },
    { id: "seed_app_ngoc_ai", userId: "seed_ngoc", jobId: "seed_job_ai", resumeId: resumeMap.seed_ngoc.id, status: "AI_INTERVIEW_PENDING", sessionId: null, score: 0 },
  ];
  for (const seed of applicationSeeds) {
    const application = await prisma.application.upsert({ where: { userId_jobId: { userId: seed.userId, jobId: seed.jobId } }, create: { id: seed.id, userId: seed.userId, jobId: seed.jobId, resumeId: seed.resumeId, status: seed.status, appliedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), shortlistedAt: ["FACE_TO_FACE_SCHEDULED"].includes(seed.status) ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null, faceToFaceScheduledAt: seed.status === "FACE_TO_FACE_SCHEDULED" ? new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) : null }, update: { resumeId: seed.resumeId, status: seed.status } });
    if (!seed.sessionId) {
      await prisma.interviewSession.deleteMany({ where: { applicationId: application.id } });
    }
    const resume = resumeMap[seed.userId];
    const match = matchResumeToJob({ jobTitle: jobs[seed.jobId].title, jobDescription: jobs[seed.jobId].descriptionRaw, resumeText: resume.parsedText ?? "" });
    await prisma.jobMatch.upsert({ where: { userId_jobId: { userId: seed.userId, jobId: seed.jobId } }, create: { userId: seed.userId, jobId: seed.jobId, resumeId: seed.resumeId, overallScore: match.overallScore, technicalScore: match.technicalScore, experienceScore: match.experienceScore, domainScore: match.domainScore, softSkillsScore: match.softSkillsScore, atsScore: match.atsCompatibilityScore, matchSummaryJson: match }, update: { resumeId: seed.resumeId, overallScore: match.overallScore, technicalScore: match.technicalScore, experienceScore: match.experienceScore, domainScore: match.domainScore, softSkillsScore: match.softSkillsScore, atsScore: match.atsCompatibilityScore, matchSummaryJson: match } });
    if (seed.sessionId) await seedInterview({ id: seed.sessionId, userId: seed.userId, job: jobs[seed.jobId], applicationId: application.id, resume: resumeMap[seed.userId], status: "COMPLETED", scoreSeed: seed.score });
    if (seed.status === "FACE_TO_FACE_SCHEDULED") await prisma.faceToFaceSchedule.upsert({ where: { id: `seed_schedule_${application.id}` }, create: { id: `seed_schedule_${application.id}`, applicationId: application.id, scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), timezone: "Asia/Ho_Chi_Minh", interviewerName: "Nguyễn Minh — CTO", meetingUrl: "https://meet.jit.si/pivotassist-seed-cto", status: "SCHEDULED", notes: "Lịch mẫu để kiểm tra luồng vòng 2." }, update: { scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), status: "SCHEDULED" } });
  }
}

async function cleanupJunkRecords() {
  const seedJobIds = jobSeeds.map((job) => job.id);
  const extraJobsFull = await prisma.job.findMany({
    where: { id: { notIn: seedJobIds } },
    select: { id: true, title: true, company: { select: { name: true } } },
  });
  const junkJobIds = extraJobsFull.filter((job) => {
    const title = job.title ?? "";
    const company = job.company?.name ?? "";
    const garbageTitle = /(.)\1{5,}/.test(title) || /1111111|asdf|qwerty/i.test(title);
    const garbageCompany = company.length < 4 || (/^[0-9]{2,}/.test(company) && company.length < 16 && !/\s/.test(company)) || /asdf|qwerty|dummy/i.test(company);
    return garbageTitle || garbageCompany;
  }).map((job) => job.id);
  if (junkJobIds.length > 0) {
    await prisma.interviewSession.updateMany({ where: { jobId: { in: junkJobIds } }, data: { jobId: null } });
    await prisma.job.deleteMany({ where: { id: { in: junkJobIds } } });
  }
  const extraCompanies = await prisma.company.findMany({ where: { id: { notIn: ["seed_company_nexus", "seed_company_vanguard"] } }, select: { id: true, name: true, _count: { select: { jobs: true } } } });
  for (const company of extraCompanies) {
    const garbageName = company.name.length < 4 || /[0-9]{3,}/.test(company.name) && company.name.length < 16 && !/\s/.test(company.name);
    if (garbageName && company._count.jobs === 0) {
      await prisma.company.delete({ where: { id: company.id } }).catch(() => null);
    }
  }
}

async function main() {
  const userMap = await seedUsers();
  await seedCompanies();
  const skillMap = await seedSkills();
  await seedJobs(skillMap);
  await cleanupJunkRecords();
  const resumeMap = await seedResumes(userMap);
  await seedApplications(userMap, resumeMap);
  await prisma.notification.upsert({ where: { id: "seed_notification_nam" }, create: { id: "seed_notification_nam", userId: "seed_nam", type: "WELCOME", title: "Chào mừng đến PivotAssist", body: "CV mẫu và workspace demo đã sẵn sàng để bạn thử flow Application → AI Interview → Evaluation.", href: "/applications" }, update: {} });
  console.log("Seed complete. Demo account emails (passwords are not logged; use your local seed notes).");
  console.log("admin@pivotassist.local");
  console.log("recruiter@nexusai.local");
  console.log("nam.nguyen@example.com");
  console.log("quang.tran@example.com");
  console.log("ha.le@example.com");
  console.log("ngoc.vu@example.com");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
