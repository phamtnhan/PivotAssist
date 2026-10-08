import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORICAL_JWT_FALLBACK,
  isUnsafeJwtSecret,
  jwtSecretKey,
  requireJwtSecret,
} from "./jwt-secret.ts";

test("JWT_SECRET fail-closed rejects missing, short, and historical fallback", () => {
  assert.equal(isUnsafeJwtSecret(undefined), true);
  assert.equal(isUnsafeJwtSecret(""), true);
  assert.equal(isUnsafeJwtSecret("short"), true);
  assert.equal(isUnsafeJwtSecret(HISTORICAL_JWT_FALLBACK), true);
  assert.equal(isUnsafeJwtSecret("pivotassist-local-dev-secret"), false);
});

test("requireJwtSecret throws on historical fallback and jwtSecretKey encodes a safe secret", () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = HISTORICAL_JWT_FALLBACK;
  assert.throws(() => requireJwtSecret(), /JWT_SECRET_UNSAFE/);
  process.env.JWT_SECRET = "pivotassist-local-dev-secret";
  const key = jwtSecretKey();
  assert.equal(key.byteLength, new TextEncoder().encode("pivotassist-local-dev-secret").byteLength);
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  assert.equal(isUnsafeJwtSecret("change_me_in_production_ok"), true);
  process.env.NODE_ENV = nodeEnv;
  if (previous === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previous;
});
