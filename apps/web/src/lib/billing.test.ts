import assert from "node:assert/strict";
import test from "node:test";
import { isFreeLocalBillingAllowed, isPayableInvoiceStatus } from "./billing-policy.ts";

test("only PENDING and AWAITING_CONFIRM are payable", () => {
  assert.equal(isPayableInvoiceStatus("PENDING"), true);
  assert.equal(isPayableInvoiceStatus("AWAITING_CONFIRM"), true);
  assert.equal(isPayableInvoiceStatus("PAID"), false);
  assert.equal(isPayableInvoiceStatus("CANCELLED"), false);
  assert.equal(isPayableInvoiceStatus("EXPIRED"), false);
});

test("free-local is refused when NODE_ENV is production", () => {
  assert.equal(isFreeLocalBillingAllowed("free-local", "production"), false);
  assert.equal(isFreeLocalBillingAllowed("free-local", "development"), true);
  assert.equal(isFreeLocalBillingAllowed("vietqr", "development"), false);
});
