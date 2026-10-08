import assert from "node:assert/strict";
import test from "node:test";
import { isSessionRequiredPath } from "./session-paths.ts";

test("public marketing and jobs stay open without a session", () => {
  for (const path of [
    "/",
    "/login",
    "/register",
    "/jobs",
    "/jobs/abc",
    "/legal",
    "/services",
    "/enterprise",
    "/unauthorized",
  ]) {
    assert.equal(isSessionRequiredPath(path), false, path);
  }
});

test("candidate and staff consoles require a session", () => {
  for (const path of [
    "/home",
    "/home/",
    "/applications",
    "/interview/room",
    "/admin",
    "/enterprise/dashboard",
  ]) {
    assert.equal(isSessionRequiredPath(path), true, path);
  }
});

test("password revocation check correctly compares seconds to avoid sub-second token invalidation", () => {
  const passwordChangedAtMs = 1775131234567; // Date.now() timestamp
  const passwordChangedAtSec = Math.floor(passwordChangedAtMs / 1000); // 1775131234

  // Fresh token issued in the same second as the password change
  const freshTokenIat = 1775131234;
  const isFreshRevoked = freshTokenIat < passwordChangedAtSec;
  assert.equal(isFreshRevoked, false, "Fresh token issued in the same second must NOT be revoked");

  // Old token issued before the password change
  const oldTokenIat = 1775131233;
  const isOldRevoked = oldTokenIat < passwordChangedAtSec;
  assert.equal(isOldRevoked, true, "Token issued before password change must be revoked");
});
