import { parseResumeText } from "@pivotassist/free-ai";
import { extractResumeDocument } from "@/lib/resume-extract";

export async function extractResumeText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  providedText?: string,
): Promise<string> {
  const extracted = await extractResumeDocument(buffer, mimeType, filename, providedText);
  return extracted.text;
}

export async function extractResumeForParse(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  providedText?: string,
) {
  const extracted = await extractResumeDocument(buffer, mimeType, filename, providedText);
  return extracted;
}

export function parseResumeForStorage(text: string, filename: string) {
  const parsed = parseResumeText(text, filename);
  return {
    parsedText: text,
    rawJson: parsed,
    parsed,
  };
}

export function safeFileName(filename: string): string {
  const normalized = filename
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
  return normalized.slice(0, 160) || "resume.txt";
}
