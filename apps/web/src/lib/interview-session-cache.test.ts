import assert from "node:assert/strict";
import test from "node:test";
import { readPromptList } from "./interview-session-cache.ts";

test("readPromptList keeps string questions and prepends firstQuestion", () => {
  const prompts = readPromptList({
    firstQuestion: "Câu mở đầu",
    questions: ["Câu mở đầu", "Câu 2", 12, null, { prompt: "x" }, "Câu 3"],
  });
  assert.deepEqual(prompts, ["Câu mở đầu", "Câu 2", "Câu 3"]);
});

test("readPromptList returns empty for unknown payloads", () => {
  assert.deepEqual(readPromptList(undefined), []);
  assert.deepEqual(readPromptList({ questions: "nope" }), []);
});
