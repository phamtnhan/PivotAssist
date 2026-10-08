import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { isSafeAvatarKey, resolveAvatarAbsolutePath } from "./avatar-file-key.ts";

test("avatar key rejects traversal and prefix spoofing", () => {
  const userId = "user_1";
  assert.equal(isSafeAvatarKey(`local:uploads/avatars/${userId}/face.png`, userId), true);
  assert.equal(isSafeAvatarKey(`local:uploads/avatars/${userId}/../secret.png`, userId), false);
  assert.equal(isSafeAvatarKey("local:uploads/avatars/other/face.png", userId), false);
  assert.equal(isSafeAvatarKey(`local:uploads/avatars/${userId}/nested/face.png`, userId), false);
  assert.equal(isSafeAvatarKey("", userId), false);
});

test("resolved avatar path stays under .data", () => {
  const cwd = "C:\\repo";
  const safe = resolveAvatarAbsolutePath("local:uploads/avatars/user_1/face.png", cwd);
  assert.ok(safe);
  assert.equal(safe, path.resolve(cwd, ".data", "uploads", "avatars", "user_1", "face.png"));
  assert.equal(resolveAvatarAbsolutePath("local:uploads/avatars/user_1/../face.png", cwd), null);
});
