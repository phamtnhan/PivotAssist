import assert from "node:assert/strict";
import test from "node:test";
import { allowedBrowserOrigins, isAllowedBrowserOrigin } from "./browser-origins.ts";

test("localhost origins are allowed for CSRF checks", () => {
  assert.equal(allowedBrowserOrigins().has("http://localhost:3000"), true);
  assert.equal(
    isAllowedBrowserOrigin(
      new Request("http://localhost:3000/x", { headers: { origin: "http://evil.example" } }),
    ),
    false,
  );
  assert.equal(
    isAllowedBrowserOrigin(
      new Request("http://localhost:3000/x", { headers: { origin: "http://localhost:3000" } }),
    ),
    true,
  );
  assert.equal(isAllowedBrowserOrigin(new Request("http://localhost:3000/x")), false);
});
