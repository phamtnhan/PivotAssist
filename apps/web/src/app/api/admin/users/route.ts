import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse, paginationFromRequest, writeAuditLog } from "@/lib/server-utils";
import { toInputJsonValue } from "@/lib/user-preferences";

const PatchSchema = z
  .object({
    userId: z.string().min(1),
    isActive: z.boolean().optional(),
    role: z.enum(["CANDIDATE", "RECRUITER", "ADMIN"]).optional(),
    grantSessions: z.number().int().min(1).max(1000).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới xem được người dùng.", 403);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const role = url.searchParams.get("role");
  const { page, pageSize, skip } = paginationFromRequest(request, { pageSize: 50 });
  try {
    const where = {
      ...(q ? { OR: [{ fullName: { contains: q } }, { email: { contains: q } }] } : {}),
      ...(role && role !== "all" ? { role: role as "CANDIDATE" | "RECRUITER" | "ADMIN" } : {}),
    };
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          preferencesJson: true,
          createdAt: true,
          _count: { select: { interviews: true, applications: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return NextResponse.json({
      success: true,
      users,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[Admin Users GET]", error);
    return errorResponse("Không thể tải danh sách người dùng.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới cập nhật được người dùng.", 403);
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (
    !parsed.success ||
    (parsed.data.isActive === undefined &&
      parsed.data.role === undefined &&
      parsed.data.grantSessions === undefined)
  )
    return errorResponse("Dữ liệu cập nhật người dùng không hợp lệ.", 400);
  if (parsed.data.userId === admin.userId && parsed.data.isActive === false)
    return errorResponse("Không thể tự khóa tài khoản quản trị hiện tại.", 409);
  if (
    parsed.data.userId === admin.userId &&
    parsed.data.role !== undefined &&
    parsed.data.role !== "ADMIN"
  )
    return errorResponse("Không thể tự hạ quyền tài khoản quản trị hiện tại.", 409);
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: parsed.data.userId },
        select: { role: true, isActive: true },
      });
      if (!target) throw new Error("USER_NOT_FOUND");

      const nextRole = parsed.data.role ?? target.role;
      const nextIsActive = parsed.data.isActive ?? target.isActive;
      if (target.role === "ADMIN" && target.isActive && (nextRole !== "ADMIN" || !nextIsActive)) {
        const activeAdminCount = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
        if (activeAdminCount <= 1) throw new Error("LAST_ACTIVE_ADMIN");
      }

      let nextPreferences: Record<string, unknown> | undefined;
      if (parsed.data.grantSessions !== undefined) {
        const rows = await tx.$queryRaw<Array<{ preferencesJson: unknown }>>`
          SELECT preferencesJson FROM User WHERE id = ${parsed.data.userId} FOR UPDATE
        `;
        if (rows.length === 0) {
          throw new Error("USER_NOT_FOUND");
        }
        const rawPrefs = rows[0]?.preferencesJson;
        let currentPrefs: Record<string, unknown> = {};
        if (rawPrefs && typeof rawPrefs === "object" && !Array.isArray(rawPrefs)) {
          currentPrefs = rawPrefs as Record<string, unknown>;
        } else if (typeof rawPrefs === "string") {
          try {
            currentPrefs = JSON.parse(rawPrefs);
          } catch {}
        }
        nextPreferences = {
          ...currentPrefs,
          remainingSessions: Math.max(
            0,
            Number(currentPrefs.remainingSessions ?? 0) + parsed.data.grantSessions,
          ),
        };
      }
      return tx.user.update({
        where: { id: parsed.data.userId },
        data: {
          ...(parsed.data.isActive === undefined ? {} : { isActive: parsed.data.isActive }),
          ...(parsed.data.role === undefined ? {} : { role: parsed.data.role }),
          ...(nextPreferences !== undefined
            ? { preferencesJson: toInputJsonValue(nextPreferences) }
            : {}),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          preferencesJson: true,
        },
      });
    });
    await writeAuditLog(admin, "admin.user_updated", updated.id, parsed.data);
    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return errorResponse("Không tìm thấy người dùng.", 404);
    }
    if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
      return errorResponse("Phải duy trì ít nhất một quản trị viên đang hoạt động.", 409);
    }
    console.error("[Admin Users PATCH]", error);
    return errorResponse("Không thể cập nhật người dùng.", 503);
  }
}
