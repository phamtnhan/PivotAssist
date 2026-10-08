import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";
import {
  activatePaidInvoice,
  BILLING_PLANS,
  billingMode,
  isFreeLocalBillingAllowed,
  maskAccount,
  transferContentFor,
  vietQrConfig,
  vietQrImageUrl,
} from "@/lib/billing";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { createMomoPayment, momoConfig } from "@/lib/momo";

const Schema = z
  .object({
    planId: z.enum(["starter", "pro", "master"]),
    provider: z.enum(["vietqr", "momo"]).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để chọn gói dịch vụ.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Gói dịch vụ không hợp lệ.", 400);
  const plan = BILLING_PLANS[parsed.data.planId];
  const mode = billingMode();
  const qr = vietQrConfig();
  const momo = momoConfig();
  const requestedProvider = parsed.data.provider ?? "vietqr";

  try {
    if (String(requestedProvider) === "momo") {
      return errorResponse(
        "Thanh toán MoMo đang tạm bảo trì. Vui lòng dùng QR ngân hàng và chờ admin xác nhận thủ công.",
        503,
        "PAYMENT_MAINTENANCE",
      );
    }
    if (mode === "vietqr" && requestedProvider === "vietqr" && !qr.configured) {
      return errorResponse(
        "Thanh toán QR đang tạm bảo trì vì chưa có ảnh QR ngân hàng tĩnh. Hãy cấu hình BILLING_STATIC_QR_URL.",
        503,
        "VIETQR_NOT_CONFIGURED",
      );
    }

    const existing = await prisma.billingInvoice.findFirst({
      where: {
        userId: user.userId,
        planId: plan.planId,
        status: { in: ["PENDING", "AWAITING_CONFIRM"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        invoice: existing,
        payUrl: existing.provider === "momo" ? existing.qrImageUrl : null,
        message:
          existing.status === "AWAITING_CONFIRM"
            ? "Đơn đang chờ admin đối soát. Không kích hoạt gói cho đến khi tiền được xác nhận."
            : existing.provider === "momo"
              ? "Đã có hóa đơn MoMo PENDING. Hoàn tất thanh toán trên cổng MoMo — hệ thống không tự đánh PAID."
              : "Đã có hóa đơn chưa thanh toán cho gói này. Chuyển khoản đúng nội dung để được kích hoạt.",
      });
    }

    const invoiceId = `inv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const transferContent = transferContentFor(invoiceId);

    if (mode === "free-local") {
      if (!isFreeLocalBillingAllowed()) {
        return errorResponse(
          "BILLING_MODE=free-local bị tắt ngoài môi trường local.",
          403,
          "BILLING_MODE_FORBIDDEN",
        );
      }
      const created = await prisma.billingInvoice.create({
        data: {
          id: invoiceId,
          userId: user.userId,
          planId: plan.planId,
          sessionsCount: plan.sessionsCount,
          amountVnd: plan.amountVnd,
          status: "PAID",
          provider: "free-local",
          transferContent,
          paidAt: new Date(),
        },
      });
      await activatePaidInvoice(created);
      await writeAuditLog(user, "billing.plan_activated", created.id, {
        planId: plan.planId,
        provider: "free-local",
      });
      return NextResponse.json({
        success: true,
        invoice: created,
        provider: "free-local",
        status: "PAID",
        message: "Đã kích hoạt gói local (BILLING_MODE=free-local). Không đi qua cổng thanh toán.",
      });
    }

    if (requestedProvider === "momo") {
      const payment = await createMomoPayment({
        orderId: invoiceId,
        amountVnd: plan.amountVnd,
        orderInfo: `PivotAssist ${plan.planId} ${transferContent}`,
      });
      const created = await prisma.billingInvoice.create({
        data: {
          id: invoiceId,
          userId: user.userId,
          planId: plan.planId,
          sessionsCount: plan.sessionsCount,
          amountVnd: plan.amountVnd,
          status: "PENDING",
          provider: "momo",
          transferContent,
          qrImageUrl: payment.payUrl,
        },
      });
      await writeAuditLog(user, "billing.invoice_created", created.id, {
        planId: plan.planId,
        amountVnd: plan.amountVnd,
        provider: "momo",
      });
      return NextResponse.json({
        success: true,
        invoice: created,
        provider: "momo",
        status: "PENDING",
        payUrl: payment.payUrl,
        message:
          "Đã tạo yêu cầu MoMo. Gói chỉ kích hoạt sau IPN chữ ký hợp lệ — không tự đánh PAID.",
      });
    }

    const created = await prisma.billingInvoice.create({
      data: {
        id: invoiceId,
        userId: user.userId,
        planId: plan.planId,
        sessionsCount: plan.sessionsCount,
        amountVnd: plan.amountVnd,
        status: "PENDING",
        provider: "vietqr",
        transferContent,
        qrImageUrl: vietQrImageUrl({ amountVnd: plan.amountVnd, addInfo: transferContent }),
        accountName: qr.accountName || null,
        accountNoMasked: qr.accountNo ? maskAccount(qr.accountNo) : null,
        bankBin: qr.bankBin || null,
      },
    });

    await writeAuditLog(user, "billing.invoice_created", created.id, {
      planId: plan.planId,
      amountVnd: plan.amountVnd,
    });
    return NextResponse.json({
      success: true,
      invoice: created,
      provider: "vietqr",
      status: "PENDING",
      bankConfigured: qr.configured,
      message: qr.configured
        ? `Quét VietQR và chuyển ${plan.amountVnd.toLocaleString("vi-VN")}đ với nội dung ${transferContent}. Gói chỉ kích hoạt sau khi admin xác nhận.`
        : `Đã tạo hóa đơn ${transferContent}. Cấu hình BILLING_BANK_BIN và BILLING_ACCOUNT_NO để hiện QR, hoặc chờ admin xác nhận chuyển khoản.`,
    });
  } catch (error) {
    console.error("[Billing Checkout POST]", error instanceof Error ? error.message : error);
    return errorResponse(
      error instanceof Error ? error.message : "Không thể tạo hóa đơn thanh toán.",
      503,
    );
  }
}
