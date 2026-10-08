import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, prisma } from "@/lib/auth";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const PostSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

function classify(role: string): "USER" | "ENTERPRISE" {
  return role === "RECRUITER" || role === "ADMIN" ? "ENTERPRISE" : "USER";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để chat hỗ trợ.", 401);
  const ticket = await prisma.supportTicket.findFirst({
    where: { userId: user.userId, status: { not: "RESOLVED" } },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 80 } },
  });
  return NextResponse.json({
    success: true,
    ticketId: ticket?.id ?? null,
    messages: ticket?.messages ?? [],
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để chat hỗ trợ.", 401);
  const parsed = PostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Nội dung chat không hợp lệ.", 400);
  const actorKind = classify(user.role);
  try {
    const existing = await prisma.supportTicket.findFirst({
      where: { userId: user.userId, status: { not: "RESOLVED" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    const ticket = existing
      ? await prisma.supportTicket.update({
          where: { id: existing.id },
          data: {
            message: parsed.data.body,
            status: "OPEN",
            messages: { create: { sender: "USER", body: parsed.data.body } },
          },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 80 } },
        })
      : await prisma.supportTicket.create({
          data: {
            userId: user.userId,
            actorKind,
            classification: actorKind,
            subject: parsed.data.body.slice(0, 80),
            message: parsed.data.body,
            status: "OPEN",
            messages: { create: { sender: "USER", body: parsed.data.body } },
          },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 80 } },
        });
    await writeAuditLog(user, "support.chat", ticket.id, {
      preview: parsed.data.body.slice(0, 80),
    });
    const { publishToRole, publishToUser } = await import("@/lib/realtime-hub");
    publishToUser(user.userId, "support");
    publishToRole("ADMIN", "support");
    return NextResponse.json({ success: true, ticketId: ticket.id, messages: ticket.messages });
  } catch (error) {
    console.error("[Support chat POST]", error);
    return errorResponse("Không gửi được tin nhắn.", 503);
  }
}
