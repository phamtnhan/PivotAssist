import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { createNotification, errorResponse, writeAuditLog } from "@/lib/server-utils";

const PatchSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
    classification: z.enum(["USER", "ENTERPRISE"]).optional(),
    reply: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.status !== undefined || value.classification !== undefined || value.reply !== undefined,
    { message: "Cần có thay đổi để cập nhật ticket." },
  );

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới xem được hộp thư hỗ trợ.", 403);
  const classification = new URL(request.url).searchParams.get("classification");
  const where =
    classification === "USER" || classification === "ENTERPRISE" ? { classification } : {};
  const [tickets, userCount, enterpriseCount] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        subject: true,
        message: true,
        status: true,
        classification: true,
        createdAt: true,
        user: { select: { fullName: true, email: true, role: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 40,
          select: { id: true, sender: true, body: true, createdAt: true },
        },
      },
    }),
    prisma.supportTicket.count({ where: { classification: "USER" } }),
    prisma.supportTicket.count({ where: { classification: "ENTERPRISE" } }),
  ]);
  return NextResponse.json({
    success: true,
    tickets,
    counts: {
      user: userCount,
      enterprise: enterpriseCount,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới cập nhật được hộp thư hỗ trợ.", 403);
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Dữ liệu cập nhật không hợp lệ.", 400);
  try {
    const ticket = await prisma.supportTicket.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.classification
          ? { classification: parsed.data.classification, actorKind: parsed.data.classification }
          : {}),
        ...(parsed.data.reply
          ? {
              status: parsed.data.status ?? "IN_PROGRESS",
              messages: { create: { sender: "STAFF", body: parsed.data.reply } },
            }
          : {}),
      },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 80 } },
    });
    await writeAuditLog(user, "support.updated", ticket.id, parsed.data);
    if (parsed.data.reply && ticket.userId) {
      await createNotification({
        userId: ticket.userId,
        type: "SUPPORT_REPLY",
        title: "Hỗ trợ đã trả lời",
        body: parsed.data.reply.slice(0, 160),
        href: "/home",
      });
      const { publishToRole, publishToUser } = await import("@/lib/realtime-hub");
      publishToUser(ticket.userId, "support");
      publishToRole("ADMIN", "support");
    }
    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    if (error?.code === "P2025") return errorResponse("Không tìm thấy ticket hỗ trợ.", 404);
    console.error("[Admin Support PATCH]", error);
    return errorResponse("Không thể cập nhật hộp thư hỗ trợ.", 503);
  }
}
