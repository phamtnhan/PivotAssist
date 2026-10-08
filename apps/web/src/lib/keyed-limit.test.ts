import assert from "node:assert/strict";
import test from "node:test";
import { consumeKeyedLimit, resetKeyedLimitStore } from "./keyed-limit.ts";

test("login throttle returns 429 after max attempts in the window", async () => {
  resetKeyedLimitStore("login-test");
  const now = 1_000_000;
  for (let index = 0; index < 8; index += 1) {
    const result = await consumeKeyedLimit("login-test", "ip|a@b.c", 8, 15 * 60_000, now);
    assert.equal(result.ok, true);
  }
  const blocked = await consumeKeyedLimit("login-test", "ip|a@b.c", 8, 15 * 60_000, now);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
});
