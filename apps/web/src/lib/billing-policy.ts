export const PAYABLE_INVOICE_STATUSES = ["PENDING", "AWAITING_CONFIRM"] as const;

export function billingModeFromEnv(
  billingModeValue = process.env.BILLING_MODE,
  nodeEnv = process.env.NODE_ENV,
): "free-local" | "vietqr" {
  return billingModeValue === "free-local" ? "free-local" : "vietqr";
}

export function isFreeLocalBillingAllowed(
  billingModeValue = process.env.BILLING_MODE,
  nodeEnv = process.env.NODE_ENV,
): boolean {
  return billingModeFromEnv(billingModeValue, nodeEnv) === "free-local" && nodeEnv !== "production";
}

export function isPayableInvoiceStatus(status: string): boolean {
  return (PAYABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}
