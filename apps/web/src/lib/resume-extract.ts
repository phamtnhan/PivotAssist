import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const execFileAsync = promisify(execFile);
const MAX_TEXT = 60_000;

export type ResumeExtractResult = {
  text: string;
  engine: string;
  warnings: string[];
};

const PDFTOTEXT_CANDIDATES = [
  process.env.PDFTOTEXT_PATH,
  "pdftotext.exe",
  "pdftotext",
  "C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe",
  "C:\\Program Files\\Git\\usr\\bin\\pdftotext.exe",
  "D:\\Tools\\poppler\\Library\\bin\\pdftotext.exe",
  "D:\\Tools\\poppler\\bin\\pdftotext.exe",
].filter((candidate): candidate is string => Boolean(candidate));

const TESSERACT_CANDIDATES = [
  process.env.TESSERACT_PATH,
  "tesseract.exe",
  "tesseract",
  "D:\\Tools\\Tesseract-OCR\\tesseract.exe",
  "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
  "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
].filter((candidate): candidate is string => Boolean(candidate));

const TESSDATA_DIR_CANDIDATES = [
  process.env.TESSDATA_PREFIX,
  path.join(process.cwd(), ".data", "tessdata"),
  path.join(process.cwd(), "apps", "web", ".data", "tessdata"),
  "D:\\Tools\\Tesseract-OCR\\tessdata",
  "C:\\Program Files\\Tesseract-OCR\\tessdata",
].filter((candidate): candidate is string => Boolean(candidate));

export function detectResumeKind(
  mimeType: string,
  filename: string,
): "pdf" | "docx" | "doc" | "rtf" | "text" | "image" | "unknown" {
  const name = filename.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || name.endsWith(".docx")) return "docx";
  if (mime === "application/msword" || name.endsWith(".doc")) return "doc";
  if (mime.includes("rtf") || name.endsWith(".rtf")) return "rtf";
  if (mime.startsWith("text/") || /\.(txt|md|markdown|csv)$/i.test(name)) return "text";
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tif{1,2})$/i.test(name))
    return "image";
  return "unknown";
}

function cleanExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

async function runFirstWorking(
  candidates: string[],
  args: string[],
  options?: { encoding?: BufferEncoding },
): Promise<string | null> {
  for (const executable of candidates) {
    try {
      const result = await execFileAsync(executable, args, {
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        encoding: options?.encoding ?? "utf8",
      });
      const text =
        typeof result.stdout === "string"
          ? result.stdout
          : Buffer.from(result.stdout).toString("utf8");
      if (text.trim().length >= 20) return text;
    } catch {
      // Try the next local executable.
    }
  }
  return null;
}

async function withTempFile(
  buffer: Buffer,
  extension: string,
  work: (tempPath: string) => Promise<string | null>,
): Promise<string | null> {
  const tempDir = path.join(process.cwd(), ".data", "tmp");
  const tempPath = path.join(tempDir, `${randomUUID()}${extension}`);
  await mkdir(tempDir, { recursive: true });
  await writeFile(tempPath, buffer);
  try {
    return await work(tempPath);
  } finally {
    await unlink(tempPath).catch(() => null);
  }
}

function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")");
}

function decodePdfHexString(hex: string): string {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, "");
  if (cleaned.length < 4) return "";
  const bytes = Buffer.from(cleaned, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode(bytes.readUInt16BE(i));
    return out;
  }
  return bytes.toString("latin1");
}

function textFromPdfOperators(content: string): string {
  const chunks: string[] = [];
  const tj = [...content.matchAll(/\((?:\\.|[^\\)]){2,}\)(?:\s*Tj|\s*')/g)];
  for (const match of tj) {
    const inner = match[0].slice(1, match[0].lastIndexOf(")"));
    const decoded = decodePdfLiteral(inner);
    if (decoded.trim()) chunks.push(decoded);
  }
  const arrays = [...content.matchAll(/\[(.*?)\]\s*TJ/gs)];
  for (const match of arrays) {
    const inner = match[1] ?? "";
    for (const piece of inner.matchAll(/\((?:\\.|[^\\)]){1,}\)|<([0-9A-Fa-f\s]+)>/g)) {
      if (piece[0].startsWith("(")) chunks.push(decodePdfLiteral(piece[0].slice(1, -1)));
      else if (piece[1]) chunks.push(decodePdfHexString(piece[1]));
    }
  }
  const hexStrings = [...content.matchAll(/<([0-9A-Fa-f]{8,})>\s*Tj/g)];
  for (const match of hexStrings) chunks.push(decodePdfHexString(match[1] ?? ""));
  return chunks.join(" ");
}

function extractPdfStreams(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const pieces: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(latin))) {
    const header = latin.slice(Math.max(0, match.index - 280), match.index);
    const payload = Buffer.from(match[1] ?? "", "latin1");
    let decoded = payload;
    if (/\/FlateDecode/.test(header)) {
      try {
        decoded = inflateRawSync(payload);
      } catch {
        try {
          decoded = inflateRawSync(payload.subarray(2));
        } catch {
          continue;
        }
      }
    }
    const asLatin = decoded.toString("latin1");
    const fromOps = textFromPdfOperators(asLatin);
    if (fromOps.trim().length >= 8) pieces.push(fromOps);
  }
  return pieces.join("\n");
}

async function extractPdfWithPdfJs(buffer: Buffer): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = "";
    }
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
      verbosity: 0,
    }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ("str" in item ? String((item as { str?: string }).str ?? "") : ""))
        .join(" ");
      if (line.trim()) pages.push(line);
    }
    await doc.destroy().catch(() => null);
    const text = pages.join("\n");
    return text.trim().length >= 20 ? text : null;
  } catch (error) {
    console.warn(
      "[resume-extract] pdfjs unavailable:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function extractPdf(buffer: Buffer): Promise<ResumeExtractResult> {
  const warnings: string[] = [];
  const fromCli = await withTempFile(buffer, ".pdf", async (tempPath) =>
    runFirstWorking(PDFTOTEXT_CANDIDATES, ["-enc", "UTF-8", "-layout", tempPath, "-"]),
  );
  if (fromCli && fromCli.trim().length >= 20) {
    return { text: cleanExtractedText(fromCli), engine: "pdftotext", warnings };
  }
  warnings.push("pdftotext không chạy được; thử pdfjs-dist.");
  const fromPdfJs = await extractPdfWithPdfJs(buffer);
  if (fromPdfJs && fromPdfJs.trim().length >= 20) {
    return { text: cleanExtractedText(fromPdfJs), engine: "pdfjs-dist", warnings };
  }
  warnings.push("pdfjs-dist không trích đủ text; thử PDF stream operators.");
  const fromStreams = extractPdfStreams(buffer);
  if (fromStreams.trim().length >= 20) {
    return { text: cleanExtractedText(fromStreams), engine: "pdf-stream-operators", warnings };
  }
  return {
    text: "",
    engine: "pdf-failed",
    warnings: [...warnings, "PDF không có text layer đủ dài. Nếu đây là scan, cần Tesseract OCR."],
  };
}

function readZipEntry(buffer: Buffer, target: string): Buffer | null {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer
      .subarray(offset + 30, offset + 30 + nameLength)
      .toString("utf8")
      .replace(/\\/g, "/");
    const dataStart = offset + 30 + nameLength + extraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    if (name === target) {
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) {
        try {
          return inflateRawSync(compressed);
        } catch {
          return null;
        }
      }
      return null;
    }
    offset = dataStart + compressedSize;
    if (flags & 0x8) {
      offset += buffer.readUInt32LE(offset) === 0x08074b50 ? 16 : 12;
    }
  }
  return null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function textFromOfficeXml(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\b[^/]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:t\b[^>]*>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  );
}

async function extractDocx(buffer: Buffer): Promise<ResumeExtractResult> {
  const warnings: string[] = [];
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (documentXml) {
      const text = cleanExtractedText(textFromOfficeXml(documentXml));
      if (text.length >= 20) return { text, engine: "docx-jszip", warnings };
    }
    warnings.push("word/document.xml trống hoặc quá ngắn.");
  } catch (error) {
    warnings.push(`jszip: ${error instanceof Error ? error.message : "load failed"}`);
  }
  const xml = readZipEntry(buffer, "word/document.xml");
  if (xml) {
    const text = cleanExtractedText(textFromOfficeXml(xml.toString("utf8")));
    if (text.length >= 20) return { text, engine: "docx-zip", warnings };
  }
  return { text: "", engine: "docx-failed", warnings: [...warnings, "Không đọc được DOCX."] };
}

function extractDocBinary(buffer: Buffer): string {
  const chunks: string[] = [];
  let index = 0;
  while (index < buffer.length - 3) {
    if (buffer[index + 1] === 0 && buffer[index] >= 32 && buffer[index] !== 127) {
      const chars: string[] = [];
      while (
        index + 1 < buffer.length &&
        buffer[index + 1] === 0 &&
        ((buffer[index] >= 32 && buffer[index] !== 127) ||
          buffer[index] === 10 ||
          buffer[index] === 13)
      ) {
        chars.push(String.fromCharCode(buffer[index]));
        index += 2;
      }
      if (chars.length >= 5) chunks.push(chars.join(""));
    } else {
      index += 1;
    }
  }
  const ascii = buffer.toString("latin1").replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ỹ]+/g, " ");
  return `${chunks.join("\n")}\n${ascii}`;
}

function extractRtf(buffer: Buffer): string {
  let text = buffer.toString("latin1");
  if (text.charCodeAt(0) === 0xfeff) text = buffer.toString("utf16le");
  text = text.replace(/\\'[0-9a-fA-F]{2}/g, (match) =>
    String.fromCharCode(parseInt(match.slice(2), 16)),
  );
  text = text.replace(/\\u(-?\d+)\s?/g, (_, code) => {
    const value = Number(code);
    return String.fromCharCode(value < 0 ? value + 65536 : value);
  });
  text = text.replace(/\\par[d]?\b/g, "\n");
  text = text.replace(/\\tab\b/g, "\t");
  text = text.replace(/\\[a-zA-Z]+\-?\d* ?/g, " ");
  text = text.replace(/[{}]/g, " ");
  return text;
}

function decodeTextBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe)
    return buffer.subarray(2).toString("utf16le");
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2)
      swapped.writeUInt16LE(buffer.readUInt16BE(i), i - 2);
    return swapped.toString("utf16le");
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  return buffer.toString("utf8");
}

function resolveTessdataDir(): string | null {
  for (const dir of TESSDATA_DIR_CANDIDATES) {
    try {
      const vie = path.join(dir, "vie.traineddata");
      const eng = path.join(dir, "eng.traineddata");
      if (existsSync(vie) || existsSync(eng)) return dir;
    } catch {
      // Try the next tessdata directory.
    }
  }
  return null;
}

export async function isTesseractAvailable(): Promise<boolean> {
  for (const executable of TESSERACT_CANDIDATES) {
    try {
      await execFileAsync(executable, ["--version"], {
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 256 * 1024,
      });
      return true;
    } catch {
      // Try the next candidate path.
    }
  }
  return false;
}

async function extractImage(buffer: Buffer, filename: string): Promise<ResumeExtractResult> {
  const extension = path.extname(filename) || ".png";
  const tessdataDir = resolveTessdataDir();
  const extra = tessdataDir ? ["--tessdata-dir", tessdataDir] : [];
  const fromCli = await withTempFile(buffer, extension, async (tempPath) => {
    const vieEng = await runFirstWorking(TESSERACT_CANDIDATES, [
      tempPath,
      "stdout",
      "-l",
      "vie+eng",
      "--psm",
      "6",
      ...extra,
    ]);
    if (vieEng) return vieEng;
    return runFirstWorking(TESSERACT_CANDIDATES, [
      tempPath,
      "stdout",
      "-l",
      "eng",
      "--psm",
      "6",
      ...extra,
    ]);
  });
  if (fromCli && fromCli.trim().length >= 20) {
    return { text: cleanExtractedText(fromCli), engine: "tesseract-cli", warnings: [] };
  }
  const available = await isTesseractAvailable();
  return {
    text: "",
    engine: available ? "image-ocr-empty" : "image-ocr-unavailable",
    warnings: [
      available
        ? "Tesseract có nhưng không đọc được chữ trên ảnh (độ nét/ngôn ngữ)."
        : "Ảnh scan cần OCR. Cài Tesseract CLI và tessdata `vie`+`eng`.",
    ],
  };
}

export async function extractResumeDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  providedText?: string,
): Promise<ResumeExtractResult> {
  if (providedText?.trim()) {
    return { text: cleanExtractedText(providedText), engine: "provided-text", warnings: [] };
  }
  const kind = detectResumeKind(mimeType, filename);
  if (kind === "text")
    return { text: cleanExtractedText(decodeTextBuffer(buffer)), engine: "utf-text", warnings: [] };
  if (kind === "pdf") return extractPdf(buffer);
  if (kind === "docx") return extractDocx(buffer);
  if (kind === "doc")
    return {
      text: cleanExtractedText(extractDocBinary(buffer)),
      engine: "doc-binary",
      warnings: ["DOC legacy: trích chuỗi UTF-16/ASCII từ OLE, độ chính xác thấp hơn DOCX."],
    };
  if (kind === "rtf")
    return { text: cleanExtractedText(extractRtf(buffer)), engine: "rtf", warnings: [] };
  if (kind === "image") return extractImage(buffer, filename);
  const asText = cleanExtractedText(decodeTextBuffer(buffer));
  if (asText.length >= 20 && !asText.includes("\u0000")) {
    return {
      text: asText,
      engine: "utf-text-fallback",
      warnings: [`MIME ${mimeType || "unknown"} được đọc như text.`],
    };
  }
  return {
    text: "",
    engine: "unsupported",
    warnings: [`Định dạng chưa hỗ trợ: ${mimeType || filename}`],
  };
}
