import assert from "node:assert/strict";
import test from "node:test";
import {
  ADAPTIVE_FALLBACK_PROVIDER,
  generateLocalAdaptiveFallback,
} from "./adaptive-interviewer-policy.ts";

test("generateLocalAdaptiveFallback handles short / vague answer with STAR probe", () => {
  const result = generateLocalAdaptiveFallback({
    jobTitle: "Frontend Developer",
    currentQuestion: { id: "q1", prompt: "Bạn đã làm việc với Next.js thế nào?", orderIndex: 1 },
    candidateSpeechText: "Tôi cũng có dùng qua một vài dự án nhỏ.",
    language: "vi",
  });

  assert.equal(result.provider, ADAPTIVE_FALLBACK_PROVIDER);
  assert.equal(result.category, "behavioral");
  assert.match(result.nextPrompt, /dự án thực tế cụ thể/i);
  assert.match(result.nextPrompt, /Action/i);
});

test("generateLocalAdaptiveFallback probes trade-offs when technology keyword is present", () => {
  const result = generateLocalAdaptiveFallback({
    jobTitle: "Backend Engineer",
    currentQuestion: { id: "q2", prompt: "Làm thế nào để cải thiện tốc độ API?", orderIndex: 2 },
    candidateSpeechText:
      "Tôi đã bổ sung Redis để lưu trữ tạm các truy vấn người dùng thường xuyên truy cập giúp giảm tải cho database PostgreSQL phía sau.",
    language: "vi",
  });

  assert.equal(result.provider, ADAPTIVE_FALLBACK_PROVIDER);
  assert.equal(result.category, "technical");
  assert.match(result.replyAudioText, /Redis/i);
  assert.match(result.nextPrompt, /đánh đổi|trade-offs|quá tải/i);
});

test("generateLocalAdaptiveFallback probes validation when metrics are present", () => {
  const result = generateLocalAdaptiveFallback({
    jobTitle: "Fullstack Engineer",
    currentQuestion: {
      id: "q3",
      prompt: "Thành tựu kỹ thuật lớn nhất của bạn là gì?",
      orderIndex: 3,
    },
    candidateSpeechText:
      "Chúng tôi đã tối ưu pipeline xử lý dữ liệu và giảm thời gian phản hồi từ 450ms xuống còn 120ms, phục vụ hơn 50000 users mỗi ngày.",
    language: "vi",
  });

  assert.equal(result.provider, ADAPTIVE_FALLBACK_PROVIDER);
  assert.equal(result.category, "system_design");
  assert.match(result.replyAudioText, /kết quả đo lường/i);
  assert.match(result.nextPrompt, /đo lường|kiểm thử|bottleneck/i);
});

test("generateLocalAdaptiveFallback provides deterministic English output for English sessions", () => {
  const input = {
    jobTitle: "Senior DevOps Engineer",
    currentQuestion: { id: "q1", prompt: "How do you manage deployments?", orderIndex: 1 },
    candidateSpeechText:
      "We deployed our microservices using Kubernetes clusters across multiple AWS regions with automated Canary releases.",
    language: "en" as const,
  };

  const result1 = generateLocalAdaptiveFallback(input);
  const result2 = generateLocalAdaptiveFallback(input);

  assert.equal(result1.provider, ADAPTIVE_FALLBACK_PROVIDER);
  assert.equal(result1.category, "technical");
  assert.match(result1.replyAudioText, /(Kubernetes|microservices)/i);
  assert.deepEqual(
    result1,
    result2,
    "Output must be completely deterministic for identical inputs",
  );
});
