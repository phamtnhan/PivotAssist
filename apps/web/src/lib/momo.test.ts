import assert from "node:assert/strict";
import test from "node:test";
import { verifyMomoSignature } from "./momo.ts";

test("verifyMomoSignature validates matching signature in constant time", () => {
  const validSignature = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
  assert.equal(verifyMomoSignature(validSignature, validSignature), true);
});

test("verifyMomoSignature rejects tampered signature of same length", () => {
  const expected = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
  const tampered = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef1";
  assert.equal(verifyMomoSignature(tampered, expected), false);
});

test("verifyMomoSignature safely rejects signature of different lengths without throwing", () => {
  const expected = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
  // Shorter
  assert.equal(verifyMomoSignature("short", expected), false);
  assert.equal(verifyMomoSignature("a1b2c3d4e5f6", expected), false);
  // Longer
  assert.equal(verifyMomoSignature(expected + "extra", expected), false);
  // Empty
  assert.equal(verifyMomoSignature("", expected), false);
  assert.equal(verifyMomoSignature(expected, ""), false);
  assert.equal(verifyMomoSignature("", ""), false);
});
