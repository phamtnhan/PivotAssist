import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { markInvoicePaidAndActivate } from "@/lib/billing";
import { createNotification, errorResponse, writeAuditLog } from "@/lib/server-utils";
import { disallowedOriginResponse } from "@/lib/request-origin";

const Schema = z
  .object({ invoiceId: z.string().min(4), action: z.enum(["confirm", "cancel"]) })
  .strict();

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới xem được thanh toán.", 403);
  try {
    const invoices = await prisma.billingInvoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { fullName: true, email: true } } },
    });
    return NextResponse.json({ success: true, invoices });
  } catch (error) {
    console.error("[Admin Billing GET]", error);
    return errorResponse("Không thể tải hóa đơn.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới xác nhận thanh toán.", 403);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Yêu cầu xác nhận không hợp lệ.", 400);
  try {
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: parsed.data.invoiceId },
    });
    if (!invoice) return errorResponse("Không tìm thấy hóa đơn.", 404);
    if (parsed.data.action === "cancel") {
      if (invoice.status === "PAID")
        return errorResponse("Không thể hủy hóa đơn đã thanh toán.", 409);
      const updated = await prisma.billingInvoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELLED" },
      });
      await writeAuditLog(admin, "billing.invoice_cancelled", invoice.id);
      return NextResponse.json({ success: true, invoice: updated });
    }
    const result = await markInvoicePaidAndActivate({
      invoiceId: invoice.id,
      confirmedById: admin.userId,
      provider: invoice.provider || "vietqr",
    });
    if (!result.ok) {
      return errorResponse("Hóa đơn không còn hiệu lực để xác nhận.", 409);
    }
    if (!result.alreadyPaid) {
      await createNotification({
        userId: result.invoice.userId,
        type: "BILLING",
        title: "Thanh toán đã được xác nhận",
        body: `Gói ${result.invoice.planId} đã được cộng ${result.invoice.sessionsCount} lượt luyện tập.`,
        href: "/settings",
      });
      await writeAuditLog(admin, "billing.invoice_confirmed", invoice.id, {
        planId: result.invoice.planId,
      });
    }
    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      message: result.alreadyPaid
        ? "Hóa đơn đã được xác nhận trước đó."
        : "Đã xác nhận thanh toán và kích hoạt gói.",
    });
  } catch (error) {
    console.error("[Admin Billing PATCH]", error);
    return errorResponse("Không thể xác nhận thanh toán.", 503);
  }
}
