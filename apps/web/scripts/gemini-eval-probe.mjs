import { readFileSync, existsSync } from "node:fs";

function keyFrom(filePath) {
  if (!existsSync(filePath)) return "";
  const text = readFileSync(filePath, "utf8");
  const line = text.split(/\r?\n/).find((item) => item.startsWith("GEMINI_API_KEY="));
  return line ? line.slice("GEMINI_API_KEY=".length).trim().replace(/^["']|["']$/g, "") : "";
}

function modelFrom(filePath) {
  if (!existsSync(filePath)) return "";
  const text = readFileSync(filePath, "utf8");
  const line = text.split(/\r?\n/).find((item) => item.startsWith("GEMINI_TEXT_MODEL="));
  return line ? line.slice("GEMINI_TEXT_MODEL=".length).trim().replace(/^["']|["']$/g, "") : "";
}

const envFile = existsSync("C:/Users/Admin/Desktop/src/apps/web/.env.local")
  ? "C:/Users/Admin/Desktop/src/apps/web/.env.local"
  : "C:/Users/Admin/Desktop/src/.env.local";
const apiKey = keyFrom(envFile);
const model = modelFrom(envFile) || "gemini-3.6-flash";
if (!apiKey) {
  console.log(JSON.stringify({ configured: false }));
  process.exit(0);
}

const cv = "Xin chào! Tôi là Nguyễn Hoàng Quỳnh, một Chuyên viên kinh doanh với tư duy khách hàng. ".repeat(16).slice(0, 1310);
const questions = JSON.stringify([
  { id: "q1", prompt: "Hãy kể một lần bạn chốt đơn khó theo STAR.", category: "behavioral" },
  { id: "q2", prompt: "Bạn chăm sóc khách hàng sau bán như thế nào?", category: "domain" },
  { id: "q3", prompt: "Bạn đo doanh số tuần và giữ khách ra sao?", category: "technical" },
]);
const transcript = JSON.stringify([
  { questionId: "q1", speaker: "candidate", text: "Em từng phụ trách chăm sóc khách hàng và chốt đơn hàng, đo kết quả bằng doanh số tuần và tỷ lệ giữ khách." },
]);

const currentPrompt = `Đánh giá ứng viên theo JD và transcript. Trả JSON {overallScore:number,starOverallScore:number,technicalScore:number,strengths:string[],improvements:string[],feedback:[{targetSkill:string,reason:string,suggestedAction:string,severity:string}]} .\nVị trí: Chuyên viên kinh doanh\nJD: \nCV: ${cv}\nQUESTIONS: ${questions}\nTRANSCRIPT: ${transcript}`;
const compactPrompt = `Chấm interview. JSON {o,s,t,str,imp,fb:[{sk,rs,ac}]} điểm 0-100.\nROLE: Chuyên viên kinh doanh\nJD:\nCV: ${cv.slice(0, 1800)}\nQ: ${JSON.stringify([{ n: 1, q: "Chốt đơn khó STAR" }, { n: 2, q: "Chăm sóc sau bán" }, { n: 3, q: "Đo doanh số" }])}\nA: ${JSON.stringify(["Em từng phụ trách chăm sóc khách hàng và chốt đơn hàng, đo kết quả bằng doanh số tuần và tỷ lệ giữ khách."])}`;

async function call(label, { prompt, thinkingLevel, timeoutMs = 90_000, maxOutputTokens }) {
  const started = Date.now();
  const generationConfig = {
    temperature: 0.2,
    responseMimeType: "application/json",
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
    ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
  };
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Trả JSON hợp lệ, không markdown." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json().catch(() => null);
    const err = payload && typeof payload === "object" ? payload.error : null;
    return {
      label,
      status: response.status,
      ms: Date.now() - started,
      promptChars: prompt.length,
      thinkingLevel: thinkingLevel ?? "default",
      errorStatus: typeof err?.status === "string" ? err.status : null,
      errorCode: err?.code ?? null,
      errorMessage: typeof err?.message === "string" ? err.message.slice(0, 180) : null,
      hasCandidateText: Boolean(payload?.candidates?.[0]?.content?.parts?.[0]?.text),
    };
  } catch (error) {
    return {
      label,
      status: error instanceof Error ? error.name : "error",
      ms: Date.now() - started,
      promptChars: prompt.length,
      thinkingLevel: thinkingLevel ?? "default",
      errorMessage: error instanceof Error ? error.message.slice(0, 180) : "error",
    };
  }
}

const cases = [
  await call("small_minimal", { prompt: "Reply JSON {ok:true}", thinkingLevel: "MINIMAL", timeoutMs: 60_000, maxOutputTokens: 64 }),
  await call("small_default", { prompt: "Reply JSON {ok:true}", timeoutMs: 90_000, maxOutputTokens: 64 }),
  await call("e2e_compact_minimal", { prompt: compactPrompt, thinkingLevel: "MINIMAL", timeoutMs: 90_000, maxOutputTokens: 1024 }),
  await call("e2e_current_default", { prompt: currentPrompt, timeoutMs: 90_000 }),
];

console.log(JSON.stringify({
  configured: true,
  model,
  keyPresent: true,
  currentPromptChars: currentPrompt.length,
  compactPromptChars: compactPrompt.length,
  cases,
}, null, 2));
