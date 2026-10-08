import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureVerifyPasswords, REPO_ROOT, VERIFY_EMAILS } from "./verify-credentials.mjs";

const root = REPO_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function upsertEnvKey(filePath, key, value) {
  let text = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const quoted = JSON.stringify(value);
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) {
    text = text.replace(pattern, `${key}=${quoted}`);
  } else {
    if (text.length && !text.endsWith("\n")) text += "\n";
    text += `${key}=${quoted}\n`;
  }
  writeFileSync(filePath, text, "utf8");
}

function jwtSecret() {
  return randomBytes(32).toString("hex");
}

const ENV_FILES = [".env", ".env.local", path.join("apps", "web", ".env"), path.join("apps", "web", ".env.local")];

try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // DATABASE_URL may already be in the process environment.
}

const passwords = ensureVerifyPasswords();
  const secret = jwtSecret();
const jwtFiles = [];
for (const relative of ENV_FILES) {
  const abs = path.join(root, relative);
  upsertEnvKey(abs, "JWT_SECRET", secret);
  // Local WIP only (gitignored). REQ-0021: ADMIN demo stays 403 unless this flag is 1.
  upsertEnvKey(abs, "ALLOW_DEMO_AUTH", "1");
  upsertEnvKey(abs, "ALLOW_DEMO_ADMIN", "1");
  jwtFiles.push(relative);
}

const requireFromWeb = createRequire(path.join(root, "apps", "web", "package.json"));
const bcrypt = requireFromWeb("bcryptjs");
const candidateHash = await bcrypt.hash(passwords.candidate, 10);
const staffHash = await bcrypt.hash(passwords.staff, 10);

const { prisma } = await import("../packages/db/dist/index.js");
const candidateEmails = [VERIFY_EMAILS.nam, VERIFY_EMAILS.quang, VERIFY_EMAILS.ha, VERIFY_EMAILS.ngoc];
const staffEmails = [VERIFY_EMAILS.admin, VERIFY_EMAILS.recruiter];

const candidateUpdate = await prisma.user.updateMany({
  where: { email: { in: candidateEmails } },
  data: { passwordHash: candidateHash, isActive: true },
});
const staffUpdate = await prisma.user.updateMany({
  where: { email: { in: staffEmails } },
  data: { passwordHash: staffHash, isActive: true },
});

const seedUsers = [
  { email: VERIFY_EMAILS.admin, fullName: "PivotAssist Admin", role: "ADMIN", hash: staffHash, title: "Platform Administrator" },
  { email: VERIFY_EMAILS.recruiter, fullName: "Phạm Thành Nhân", role: "RECRUITER", hash: staffHash, title: "Talent Partner" },
  { email: VERIFY_EMAILS.nam, fullName: "Nguyễn Thành Nam", role: "CANDIDATE", hash: candidateHash, title: "Senior Frontend Engineer" },
  { email: VERIFY_EMAILS.quang, fullName: "Trần Minh Quang", role: "CANDIDATE", hash: candidateHash, title: "Senior Backend Engineer" },
  { email: VERIFY_EMAILS.ha, fullName: "Lê Thu Hà", role: "CANDIDATE", hash: candidateHash, title: "QA Automation Lead" },
  { email: VERIFY_EMAILS.ngoc, fullName: "Vũ Bảo Ngọc", role: "CANDIDATE", hash: candidateHash, title: "AI Product Engineer" },
];
let upserted = 0;
for (const user of seedUsers) {
  await prisma.user.upsert({
    where: { email: user.email },
    create: {
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.hash,
      role: user.role,
      isActive: true,
      profile: { create: { currentJobTitle: user.title, targetJobTitle: user.title, yearsOfExperience: user.role === "CANDIDATE" ? 4 : 0, preferredLanguage: "vi", currency: "VND" } },
    },
    update: { fullName: user.fullName, passwordHash: user.hash, role: user.role, isActive: true },
  });
  upserted += 1;
}

await prisma.$disconnect();

console.log(
  JSON.stringify({
    ok: true,
    jwtFiles: jwtFiles.length,
    candidateUsers: candidateUpdate.count,
    staffUsers: staffUpdate.count,
    upsertedUsers: upserted,
    demoAdmin: true,
    verifyEnv: true,
  }),
);
