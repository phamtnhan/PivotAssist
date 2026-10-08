import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";

function isGenericDisplayName(name?: string | null) {
  const value = (name ?? "").trim();
  if (!value) return true;
  return /^(ứng viên|ung vien|candidate|applicant|user|demo user)$/i.test(value);
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
          user: null,
        },
        { status: 401 },
      );
    }

    let fullName = user.fullName;
    if (isGenericDisplayName(fullName)) {
      const resume = await prisma.resume.findFirst({
        where: { userId: user.userId, isActive: true },
        orderBy: { updatedAt: "desc" },
        select: { rawJson: true },
      });
      const parsedName = (resume?.rawJson as { fullName?: unknown } | null)?.fullName;
      if (
        typeof parsedName === "string" &&
        parsedName.trim() &&
        !isGenericDisplayName(parsedName)
      ) {
        fullName = parsedName.trim();
        await prisma.user
          .update({ where: { id: user.userId }, data: { fullName } })
          .catch(() => null);
      }
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: { ...user, fullName },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        error: "Lỗi kiểm tra trạng thái xác thực",
      },
      { status: 500 },
    );
  }
}
