import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để tải hóa đơn.", 401);
  const invoiceId = new URL(request.url).searchParams.get("id");
  const invoice = invoiceId
    ? await prisma.billingInvoice.findFirst({ where: { id: invoiceId, userId: user.userId } })
    : await prisma.billingInvoice.findFirst({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
      });
  if (!invoice) return errorResponse("Chưa có hóa đơn để tải.", 404);
  const content = [
    "PivotAssist — Hóa đơn",
    `Mã: ${invoice.id}`,
    `Khách hàng: ${user.fullName} <${user.email}>`,
    `Gói: ${invoice.planId}`,
    `Số lượt: ${invoice.sessionsCount}`,
    `Số tiền: ${invoice.amountVnd} ${invoice.currency}`,
    `Trạng thái: ${invoice.status}`,
    `Provider: ${invoice.provider}`,
    `Nội dung CK: ${invoice.transferContent}`,
    `Ngày tạo: ${invoice.createdAt.toISOString()}`,
    invoice.paidAt ? `Ngày thanh toán: ${invoice.paidAt.toISOString()}` : "Chưa thanh toán",
  ].join("\n");
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="pivotassist-${invoice.transferContent}.txt"`,
      "Cache-Control": "private, no-store",
    },
  });
}
