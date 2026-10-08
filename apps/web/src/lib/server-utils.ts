import { NextResponse } from "next/server";
import { prisma } from "@pivotassist/db";
import type { AuthUserPayload } from "@/lib/auth";
import { englishForApiError } from "@/lib/api-errors";

export function errorResponse(message: string, status = 400, code?: string) {
  const errorEn = englishForApiError(message);
  return NextResponse.json(
    { success: false, error: message, ...(errorEn ? { errorEn } : {}), ...(code ? { code } : {}) },
    { status },
  );
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  const errorEn = englishForApiError(message);
  return NextResponse.json(
    { success: false, error: message, ...(errorEn ? { errorEn } : {}), ...extra },
    { status },
  );
}

export function jsonResponse<T>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

export function paginationFromRequest(
  request: Request,
  defaults?: { pageSize?: number; maxPageSize?: number },
) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const maxPageSize = defaults?.maxPageSize ?? 100;
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? defaults?.pageSize ?? 25) || 25),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function writeAuditLog(
  user: AuthUserPayload | null,
  action: string,
  resource: string,
  payload?: unknown,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.userId,
        action,
        resource,
        payload: payload === undefined ? undefined : JSON.parse(JSON.stringify(payload)),
      },
    });
  } catch (error) {
    console.warn(
      "[AuditLog] Unable to write audit event:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  dedupeKey?: string;
}) {
  try {
    if (input.dedupeKey) {
      const existing = await prisma.notification.findFirst({
        where: { userId: input.userId, dedupeKey: input.dedupeKey },
        select: { id: true },
      });
      if (existing) return existing;
    }
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        dedupeKey: input.dedupeKey,
      },
    });
    const { publishToUser } = await import("@/lib/realtime-hub");
    publishToUser(input.userId, "notification");
    return row;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code === "P2002" && input.dedupeKey) {
      return prisma.notification.findFirst({
        where: { userId: input.userId, dedupeKey: input.dedupeKey },
      });
    }
    console.warn(
      "[Notification] Unable to create notification:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}
