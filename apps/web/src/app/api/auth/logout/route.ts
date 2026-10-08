import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { sessionCookieClearOptions } from "@/lib/session-cookie";

export async function POST() {
  const response = NextResponse.json(
    {
      success: true,
      message: "Đã đăng xuất tài khoản thành công!",
    },
    { status: 200 },
  );

  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.set(sessionCookieClearOptions());
  return response;
}
