import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z
  .object({
    subject: z.string().trim().min(2).max(160),
    message: z.string().trim().min(2).max(5000),
    actorKind: z.enum(["USER", "ENTERPRISE"]).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để gửi yêu cầu hỗ trợ.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Nội dung yêu cầu không hợp lệ.", 400);
  const actorKind =
    parsed.data.actorKind ??
    (user.role === "RECRUITER" || user.role === "ADMIN" ? "ENTERPRISE" : "USER");
  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.userId,
        actorKind,
        classification: actorKind,
        subject: parsed.data.subject,
        message: parsed.data.message,
        status: "OPEN",
        messages: { create: { sender: "USER", body: parsed.data.message } },
      },
    });
    await writeAuditLog(user, "support.requested", ticket.id, {
      subject: parsed.data.subject,
      actorKind,
    });
    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      message: "Đã ghi nhận. Bộ phận hỗ trợ sẽ phân loại và phản hồi.",
    });
  } catch (error) {
    console.error("[Support POST]", error);
    return errorResponse("Không gửi được yêu cầu hỗ trợ.", 503);
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem yêu cầu hỗ trợ.", 401);
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ success: true, tickets });
}
