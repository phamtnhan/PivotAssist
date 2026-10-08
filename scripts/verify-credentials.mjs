import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VERIFY_ENV_PATH = path.join(REPO_ROOT, ".verify.local.env");

export const VERIFY_EMAILS = {
  admin: "admin@pivotassist.local",
  recruiter: "recruiter@nexusai.local",
  nam: "nam.nguyen@example.com",
  quang: "quang.tran@example.com",
  ha: "ha.le@example.com",
  ngoc: "ngoc.vu@example.com",
};

function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    let value = trimmed.slice(index + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, index)] = value;
  }
  return out;
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function ensureVerifyPasswords() {
  let existing = {};
  if (existsSync(VERIFY_ENV_PATH)) {
    existing = parseEnvFile(readFileSync(VERIFY_ENV_PATH, "utf8"));
  }
  const candidate =
    existing.VERIFY_CANDIDATE_PASSWORD && existing.VERIFY_CANDIDATE_PASSWORD.length >= 12
      ? existing.VERIFY_CANDIDATE_PASSWORD
      : randomToken();
  const staff =
    existing.VERIFY_STAFF_PASSWORD && existing.VERIFY_STAFF_PASSWORD.length >= 12
      ? existing.VERIFY_STAFF_PASSWORD
      : randomToken();
  const body = [
    "# Generated locally. Gitignored. Do not commit or log.",
    `VERIFY_CANDIDATE_EMAIL=${VERIFY_EMAILS.nam}`,
    `VERIFY_CANDIDATE_PASSWORD=${candidate}`,
    `VERIFY_STAFF_EMAIL=${VERIFY_EMAILS.recruiter}`,
    `VERIFY_STAFF_PASSWORD=${staff}`,
    `VERIFY_ADMIN_EMAIL=${VERIFY_EMAILS.admin}`,
    `VERIFY_ADMIN_PASSWORD=${staff}`,
    "",
  ].join("\n");
  mkdirSync(path.dirname(VERIFY_ENV_PATH), { recursive: true });
  writeFileSync(VERIFY_ENV_PATH, body, "utf8");
  return { candidate, staff };
}

export function loadVerifyCredentials() {
  if (!existsSync(VERIFY_ENV_PATH)) {
    throw new Error("Missing .verify.local.env — run: node scripts/provision-local-auth.mjs");
  }
  const env = parseEnvFile(readFileSync(VERIFY_ENV_PATH, "utf8"));
  const candidate = env.VERIFY_CANDIDATE_PASSWORD;
  const staff = env.VERIFY_STAFF_PASSWORD;
  if (!candidate || !staff) {
    throw new Error("verify.local.env missing VERIFY_*_PASSWORD");
  }
  return {
    emails: VERIFY_EMAILS,
    password: { candidate, staff },
  };
}

export function candidatePassword() {
  return loadVerifyCredentials().password.candidate;
}

export function staffPassword() {
  return loadVerifyCredentials().password.staff;
}

export function browserLoginPayload(role = "candidate") {
  const creds = loadVerifyCredentials();
  if (role === "admin") return { email: creds.emails.admin, password: creds.password.staff };
  if (role === "recruiter") return { email: creds.emails.recruiter, password: creds.password.staff };
  return { email: creds.emails.nam, password: creds.password.candidate };
}
