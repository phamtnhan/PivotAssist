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

const cv = "Xin chào! Tôi là Nguyễn Hoàng Quỳnh, Chuyên viên kinh doanh. ".repeat(20).slice(0, 1310);

async function call(label, prompt, maxOutputTokens) {
  const started = Date.now();
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Chỉ JSON. Không markdown." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens,
          thinkingConfig: { thinkingLevel: "MINIMAL" },
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const payload = await response.json().catch(() => null);
    return {
      label,
      status: response.status,
      ms: Date.now() - started,
      promptChars: prompt.length,
      errorStatus: payload?.error?.status ?? null,
      errorMessage: typeof payload?.error?.message === "string" ? payload.error.message.slice(0, 140) : null,
      hasText: Boolean(payload?.candidates?.[0]?.content?.parts?.[0]?.text),
    };
  } catch (error) {
    return {
      label,
      status: error instanceof Error ? error.name : "error",
      ms: Date.now() - started,
      errorMessage: error instanceof Error ? error.message.slice(0, 140) : "error",
    };
  }
}

const scores = await call(
  "scores_only",
  `Chấm điểm interview. JSON {o:number,s:number,t:number} 0-100.\nROLE: Chuyên viên kinh doanh\nCV: ${cv}\nQ: ["Chốt đơn khó","Chăm sóc KH","Đo doanh số"]\nA: ["Em từng phụ trách chăm sóc khách hàng và chốt đơn, đo bằng doanh số tuần và tỷ lệ giữ khách."]`,
  128,
);
const narrative = await call(
  "narrative_plus_q",
  "Nhận xét + STAR từng câu. JSON {str:string[],imp:string[],fb:[{sk,rs,ac}],q:[{id,star,tech,note}]} tối đa 3 str/imp/fb; q tối đa 2; note tối đa 12 từ.\nROLE: Chuyên viên kinh doanh\nQ:[{\"id\":\"q1\",\"q\":\"Chốt đơn khó\"},{\"id\":\"q2\",\"q\":\"Chăm sóc KH\"}]\nA:[{\"id\":\"q1\",\"a\":\"Em chốt đơn và đo doanh số tuần.\"}]",
  640,
);

console.log(JSON.stringify({ configured: true, model, cases: [scores, narrative] }, null, 2));
