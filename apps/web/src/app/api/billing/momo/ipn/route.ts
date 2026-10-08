import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pivotassist/db";
import { markInvoicePaidAndActivate } from "@/lib/billing";
import { momoConfig, momoIpnSignature, verifyMomoSignature } from "@/lib/momo";
import { errorResponse } from "@/lib/server-utils";

export async function POST(request: NextRequest) {
  const config = momoConfig();
  if (!config.configured) {
    return errorResponse("MoMo chưa cấu hình. Không chấp nhận IPN.", 503, "MOMO_NOT_CONFIGURED");
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse("IPN MoMo không hợp lệ.", 400);

  const resultCode = Number(body.resultCode);
  const amount = Number(body.amount);
  const extraData = typeof body.extraData === "string" ? body.extraData : "";
  const message = typeof body.message === "string" ? body.message : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const orderInfo = typeof body.orderInfo === "string" ? body.orderInfo : "";
  const orderType = typeof body.orderType === "string" ? body.orderType : "";
  const partnerCode = typeof body.partnerCode === "string" ? body.partnerCode : "";
  const payType = typeof body.payType === "string" ? body.payType : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const responseTime = Number(body.responseTime);
  const transId = Number(body.transId);
  const incomingSignature = typeof body.signature === "string" ? body.signature : "";

  const expected = momoIpnSignature({
    accessKey: config.accessKey,
    amount,
    extraData,
    message,
    orderId,
    orderInfo,
    orderType,
    partnerCode,
    payType,
    requestId,
    responseTime,
    resultCode,
    transId,
    secretKey: config.secretKey,
  });
  if (!verifyMomoSignature(incomingSignature, expected)) {
    return errorResponse("Chữ ký MoMo không hợp lệ.", 401, "MOMO_SIGNATURE_INVALID");
  }
  if (partnerCode !== config.partnerCode) {
    return errorResponse("partnerCode không khớp cấu hình.", 401);
  }

  try {
    const invoice = await prisma.billingInvoice.findFirst({
      where: { id: orderId, provider: "momo" },
    });
    if (!invoice) return errorResponse("Không tìm thấy hóa đơn MoMo.", 404);
    if (invoice.status === "PAID") {
      return NextResponse.json({ success: true, message: "Hóa đơn đã PAID." });
    }
    if (resultCode !== 0) {
      return NextResponse.json({
        success: true,
        ignored: true,
        message: "MoMo resultCode khác 0 — không đánh PAID.",
      });
    }
    if (amount !== invoice.amountVnd) {
      return errorResponse("Số tiền IPN không khớp hóa đơn.", 409);
    }
    const result = await markInvoicePaidAndActivate({ invoiceId: invoice.id, provider: "momo" });
    if (!result.ok) return errorResponse("Hóa đơn MoMo không còn hiệu lực.", 409);
    return NextResponse.json({ success: true, alreadyPaid: result.alreadyPaid });
  } catch (error) {
    console.error("[MoMo IPN]", error instanceof Error ? error.message : error);
    return errorResponse("Không thể xử lý IPN MoMo.", 503);
  }
}
