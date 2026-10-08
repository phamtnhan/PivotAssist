import { createHmac, timingSafeEqual } from "node:crypto";

export function momoConfig() {
  const partnerCode = process.env.MOMO_PARTNER_CODE?.trim() ?? "";
  const accessKey = process.env.MOMO_ACCESS_KEY?.trim() ?? "";
  const secretKey = process.env.MOMO_SECRET_KEY?.trim() ?? "";
  const endpoint =
    process.env.MOMO_ENDPOINT?.trim() || "https://test-payment.momo.vn/v2/gateway/api/create";
  const redirectUrl =
    process.env.MOMO_REDIRECT_URL?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/services`;
  const ipnUrl =
    process.env.MOMO_IPN_URL?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/billing/momo/ipn`;
  return {
    partnerCode,
    accessKey,
    secretKey,
    endpoint,
    redirectUrl,
    ipnUrl,
    configured: Boolean(partnerCode && accessKey && secretKey),
  };
}

function sign(raw: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(raw).digest("hex");
}

export function momoCreateSignature(input: {
  accessKey: string;
  amount: number;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
  secretKey: string;
}): string {
  const raw = [
    `accessKey=${input.accessKey}`,
    `amount=${input.amount}`,
    `extraData=${input.extraData}`,
    `ipnUrl=${input.ipnUrl}`,
    `orderId=${input.orderId}`,
    `orderInfo=${input.orderInfo}`,
    `partnerCode=${input.partnerCode}`,
    `redirectUrl=${input.redirectUrl}`,
    `requestId=${input.requestId}`,
    `requestType=${input.requestType}`,
  ].join("&");
  return sign(raw, input.secretKey);
}

export function momoIpnSignature(input: {
  accessKey: string;
  amount: number;
  extraData: string;
  message: string;
  orderId: string;
  orderInfo: string;
  orderType: string;
  partnerCode: string;
  payType: string;
  requestId: string;
  responseTime: number;
  resultCode: number;
  transId: number;
  secretKey: string;
}): string {
  const raw = [
    `accessKey=${input.accessKey}`,
    `amount=${input.amount}`,
    `extraData=${input.extraData}`,
    `message=${input.message}`,
    `orderId=${input.orderId}`,
    `orderInfo=${input.orderInfo}`,
    `orderType=${input.orderType}`,
    `partnerCode=${input.partnerCode}`,
    `payType=${input.payType}`,
    `requestId=${input.requestId}`,
    `responseTime=${input.responseTime}`,
    `resultCode=${input.resultCode}`,
    `transId=${input.transId}`,
  ].join("&");
  return sign(raw, input.secretKey);
}

export async function createMomoPayment(input: {
  orderId: string;
  amountVnd: number;
  orderInfo: string;
}): Promise<{ payUrl: string; requestId: string }> {
  const config = momoConfig();
  if (!config.configured) {
    throw new Error(
      "MoMo chưa cấu hình. Thiếu MOMO_PARTNER_CODE / MOMO_ACCESS_KEY / MOMO_SECRET_KEY.",
    );
  }
  const requestId = `${input.orderId}-${Date.now()}`;
  const requestType = "captureWallet";
  const extraData = "";
  const signature = momoCreateSignature({
    accessKey: config.accessKey,
    amount: input.amountVnd,
    extraData,
    ipnUrl: config.ipnUrl,
    orderId: input.orderId,
    orderInfo: input.orderInfo,
    partnerCode: config.partnerCode,
    redirectUrl: config.redirectUrl,
    requestId,
    requestType,
    secretKey: config.secretKey,
  });
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partnerCode: config.partnerCode,
      accessKey: config.accessKey,
      requestId,
      amount: input.amountVnd,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      redirectUrl: config.redirectUrl,
      ipnUrl: config.ipnUrl,
      extraData,
      requestType,
      lang: "vi",
      signature,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => null)) as {
    payUrl?: string;
    resultCode?: number;
    message?: string;
  } | null;
  if (!response.ok || !payload?.payUrl) {
    throw new Error(
      payload?.message
        ? `MoMo từ chối: ${payload.message}`
        : `MoMo HTTP ${response.status}. Checkout không được đánh PAID.`,
    );
  }
  return { payUrl: payload.payUrl, requestId };
}

export function verifyMomoSignature(incoming: string, expected: string): boolean {
  if (!incoming || !expected) return false;
  const incomingBuf = Buffer.from(incoming, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (incomingBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(incomingBuf, expectedBuf);
}
