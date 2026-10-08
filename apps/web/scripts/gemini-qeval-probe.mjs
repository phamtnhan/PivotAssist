import { readFileSync, existsSync } from "node:fs";

function keyFrom(filePath) {
  if (!existsSync(filePath)) return "";
  const text = readFileSync(filePath, "utf8");
  const line = text.split(/\r?\n/).find((item) => item.startsWith("GEMINI_API_KEY="));
  return line ? line.slice("GEMINI_API_KEY=".length).trim().replace(/^["']|["']$/g, "") : "";
}

const apiKey = keyFrom("C:/Users/Admin/Desktop/src/apps/web/.env.local");
const model = "gemini-3.6-flash";
if (!apiKey) {
  console.log(JSON.stringify({ configured: false }));
  process.exit(0);
}

const started = Date.now();
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
  body: JSON.stringify({
    systemInstruction: { parts: [{ text: "Chỉ JSON. Không markdown." }] },
    contents: [{ role: "user", parts: [{ text: "STAR từng câu. JSON {q:[{id,star,tech,note}]} star/tech 0-100, note tối đa 12 từ.\nQ:[{\"id\":\"q1\",\"q\":\"Chốt đơn khó\"}]\nA:[{\"id\":\"q1\",\"a\":\"Em chốt đơn, đo doanh số tuần.\"}]" }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 180,
      thinkingConfig: { thinkingLevel: "MINIMAL" },
    },
  }),
  signal: AbortSignal.timeout(60_000),
});
const payload = await response.json().catch(() => null);
const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
let parsed = null;
try { parsed = JSON.parse(String(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()); } catch { parsed = null; }
const rows = Array.isArray(parsed?.q) ? parsed.q : [];
console.log(JSON.stringify({
  configured: true,
  model,
  status: response.status,
  ms: Date.now() - started,
  errorStatus: payload?.error?.status ?? null,
  hasQ: rows.length > 0,
  firstId: typeof rows[0]?.id === "string" ? rows[0].id : null,
  hasStar: Number.isFinite(Number(rows[0]?.star)),
  hasTech: Number.isFinite(Number(rows[0]?.tech)),
  hasNote: typeof rows[0]?.note === "string" && rows[0].note.trim().length > 0,
}, null, 2));
