import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { HISTORICAL_JWT_FALLBACK, isUnsafeJwtSecret } from "./src/auth/jwt-env.ts";
import { nestUserAfterDbRecheck, tokenFromFastifyRequest, verifyHs256SessionToken } from "./src/auth/jwt-verify.ts";

function sign(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

test("Nest JWT_SECRET rejects historical fallback", () => {
  assert.equal(isUnsafeJwtSecret(HISTORICAL_JWT_FALLBACK), true);
  assert.equal(isUnsafeJwtSecret("pivotassist-local-dev-secret"), false);
});

test("Nest verifies HS256 session and ignores 2fa purpose", () => {
  const secret = "pivotassist-local-dev-secret";
  const token = sign({
    userId: "usr_1",
    email: "a@b.c",
    fullName: "Nam",
    role: "CANDIDATE",
    exp: Math.floor(Date.now() / 1000) + 60,
  }, secret);
  const user = verifyHs256SessionToken(token, secret);
  assert.equal(user?.userId, "usr_1");
  const twoFa = sign({ userId: "usr_1", email: "a@b.c", role: "CANDIDATE", purpose: "2fa", exp: Math.floor(Date.now() / 1000) + 60 }, secret);
  assert.equal(verifyHs256SessionToken(twoFa, secret), null);
});

test("Bearer and cookie extraction", () => {
  assert.equal(tokenFromFastifyRequest({ authorization: "Bearer abc" }), "abc");
  assert.equal(tokenFromFastifyRequest({ cookie: "pivotassist_session=tok%2B1; other=1" }), "tok+1");
});

test("Nest JWT re-read refuses inactive and refreshes role from MySQL", () => {
  const tokenUser = { userId: "usr_1", email: "a@b.c", fullName: "Nam", role: "CANDIDATE" as const };
  assert.equal(nestUserAfterDbRecheck(tokenUser, null), null);
  assert.equal(nestUserAfterDbRecheck(tokenUser, { isActive: false, role: "CANDIDATE" }), null);
  const refreshed = nestUserAfterDbRecheck(tokenUser, { isActive: true, role: "RECRUITER" });
  assert.equal(refreshed?.role, "RECRUITER");
  assert.equal(refreshed?.userId, "usr_1");
});

test("Nest session JWT without exp is rejected", () => {
  const secret = "pivotassist-local-dev-secret";
  const token = sign({
    userId: "usr_1",
    email: "a@b.c",
    fullName: "Nam",
    role: "CANDIDATE",
  }, secret);
  assert.equal(verifyHs256SessionToken(token, secret), null);
});
