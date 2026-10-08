import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseResumeText } from "../packages/free-ai/src/index.ts";
import { detectResumeKind, extractResumeDocument } from "../apps/web/src/lib/resume-extract.ts";

const downloads = "D:\\Downloads";
const files = readdirSync(downloads)
  .filter((name) => name.toLowerCase().endsWith(".pdf"))
  .filter((name) => /h[oồ] sơ|thiet ke|thiết kế|don sac|đơn sắc|hiện đại|hien dai/i.test(name));

if (files.length === 0) {
  console.log(JSON.stringify({ ok: false, reason: "no-matching-pdf", downloads }));
  process.exit(2);
}

const targetName = files.find((name) => /đơn sắc|don sac|hiện đại|hien dai/i.test(name)) ?? files[0];
const targetPath = path.join(downloads, targetName);
const buffer = readFileSync(targetPath);
const header = buffer.subarray(0, 16).toString("latin1");
const latin = buffer.toString("latin1");

const extracted = await extractResumeDocument(buffer, "application/pdf", targetName);
const parsed = parseResumeText(extracted.text, targetName);

console.log(JSON.stringify({
  ok: extracted.text.length >= 20,
  file: {
    name: targetName,
    bytes: statSync(targetPath).size,
    pdfHeader: header.replace(/[^\x20-\x7E]/g, "."),
    encrypted: /\/Encrypt\b/.test(latin),
    hasFont: /\/Font\b/.test(latin),
    imageXObject: (latin.match(/\/Subtype\s*\/Image/g) ?? []).length,
    pageCountHint: (latin.match(/\/Type\s*\/Page\b/g) ?? []).length,
    kind: detectResumeKind("application/pdf", targetName),
  },
  extract: {
    engine: extracted.engine,
    chars: extracted.text.length,
    warnings: extracted.warnings,
    preview: extracted.text.replace(/\s+/g, " ").slice(0, 280),
  },
  parsed: {
    hasFullName: Boolean(parsed.fullName),
    fullNameLooksLikeIntro: Boolean(parsed.fullName && /kỹ sư|engineer|developer/i.test(parsed.fullName)),
    title: parsed.currentJobTitle,
    yearsOfExperience: parsed.yearsOfExperience,
    skillCount: parsed.extractedSkills.length,
    skills: parsed.extractedSkills,
    experienceCount: parsed.experiences.length,
    experiences: parsed.experiences.map((item) => ({
      role: item.role.slice(0, 80),
      company: item.company.slice(0, 80),
      period: item.period.slice(0, 40),
      bulletCount: item.bullets.length,
    })),
    hasEmail: Boolean(parsed.email),
    hasPhone: Boolean(parsed.phone),
    hasLocation: Boolean(parsed.location),
    educationCount: parsed.education.length,
    sectionKeys: Object.keys(parsed.sections),
  },
  layout: {
    firstLines: extracted.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 18),
    goHits: [...extracted.text.matchAll(/.{0,20}Go.{0,20}/gi)].map((m) => m[0]),
  },
}, null, 2));
