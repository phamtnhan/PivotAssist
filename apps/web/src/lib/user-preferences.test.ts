import assert from "node:assert/strict";
import test from "node:test";
import { mergePreferences, remainingSessionCredits, toInputJsonValue } from "./user-preferences.ts";

test("remainingSessionCredits treats missing quota as unlimited", () => {
  assert.equal(remainingSessionCredits({}), null);
  assert.equal(remainingSessionCredits({ remainingSessions: 3 }), 3);
  assert.equal(remainingSessionCredits({ remainingSessions: 0 }), 0);
  assert.equal(remainingSessionCredits({ remainingSessions: "5" }), null);
});

test("toInputJsonValue is a JSON-safe Prisma boundary", () => {
  const json = toInputJsonValue({ plan: "pro", remainingSessions: 4, nested: { ok: true } });
  assert.deepEqual(json, { plan: "pro", remainingSessions: 4, nested: { ok: true } });
});

test("mergePreferences ignores client entitlement and TOTP writes", () => {
  const merged = mergePreferences(
    {
      remainingSessions: 2,
      plan: "starter",
      theme: "light",
      twoFactorEnabled: true,
      totpSecretEncrypted: "keep",
    },
    {
      remainingSessions: 99,
      plan: "master",
      billingStatus: "ACTIVE",
      billingProvider: "free-local",
      activatedInvoiceIds: ["inv_x"],
      twoFactorEnabled: false,
      totpSecretEncrypted: "steal",
      theme: "dark",
      notifyEmail: true,
    },
  );
  assert.equal(merged.remainingSessions, 2);
  assert.equal(merged.plan, "starter");
  assert.equal(merged.billingStatus, undefined);
  assert.equal(merged.theme, "dark");
  assert.equal(merged.notifyEmail, true);
  assert.equal(merged.twoFactorEnabled, true);
  assert.equal(merged.totpSecretEncrypted, "keep");
});

test("mergePreferences sanitizes bookmark and favorite id lists", () => {
  const merged = mergePreferences({}, {
    jobBookmarks: ["job-1", " ", 12, "job-1", "x".repeat(90)],
    favoriteTracks: ["cv-master", null],
  } as Record<string, unknown>);
  assert.deepEqual(merged.jobBookmarks, ["job-1"]);
  assert.deepEqual(merged.favoriteTracks, ["cv-master"]);
});
