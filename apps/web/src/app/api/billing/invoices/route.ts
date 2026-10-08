import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { errorResponse } from "@/lib/server-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem hóa đơn.", 401);
  try {
    const invoices = await prisma.billingInvoice.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ success: true, invoices });
  } catch (error) {
    console.error("[Billing Invoices GET]", error);
    return errorResponse("Không thể tải hóa đơn.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập.", 401);
  const body = (await request.json().catch(() => null)) as { invoiceId?: string } | null;
  if (!body?.invoiceId) return errorResponse("Thiếu mã hóa đơn.", 400);
  try {
    const invoice = await prisma.billingInvoice.findFirst({
      where: { id: body.invoiceId, userId: user.userId },
    });
    if (!invoice) return errorResponse("Không tìm thấy hóa đơn.", 404);
    if (invoice.status === "PAID")
      return NextResponse.json({ success: true, invoice, message: "Hóa đơn đã được thanh toán." });
    if (invoice.status === "CANCELLED" || invoice.status === "EXPIRED")
      return errorResponse("Hóa đơn không còn hiệu lực.", 409);
    const updated = await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: { status: "AWAITING_CONFIRM" },
    });
    return NextResponse.json({
      success: true,
      invoice: updated,
      message: "Đã ghi nhận bạn đã chuyển khoản. Gói sẽ được kích hoạt sau khi admin đối soát.",
    });
  } catch (error) {
    console.error("[Billing Invoices PATCH]", error);
    return errorResponse("Không thể cập nhật hóa đơn.", 503);
  }
}
