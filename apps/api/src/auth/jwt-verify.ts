// REQ-0023 — HS256 verify compatible with jose SignJWT used by apps/web
import { createHmac, timingSafeEqual } from "node:crypto";

export type NestAuthUser = {
  userId: string;
  email: string;
  fullName: string;
  role: "CANDIDATE" | "RECRUITER" | "ADMIN";
  iat?: number;
};

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function verifyHs256SessionToken(token: string, secret: string): NestAuthUser | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(base64UrlToBuffer(headerPart).toString("utf8")) as {
      alg?: unknown;
      typ?: unknown;
    };
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;

  const expected = createHmac("sha256", secret).update(`${headerPart}.${payloadPart}`).digest();
  const actual = base64UrlToBuffer(signaturePart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlToBuffer(payloadPart).toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
  if (payload.purpose === "2fa") return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
  if (typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
  if (payload.role !== "CANDIDATE" && payload.role !== "RECRUITER" && payload.role !== "ADMIN")
    return null;
  return {
    userId: payload.userId,
    email: payload.email,
    fullName: typeof payload.fullName === "string" ? payload.fullName : "",
    role: payload.role,
    iat: typeof payload.iat === "number" ? payload.iat : undefined,
  };
}

export function nestUserAfterDbRecheck(
  tokenUser: NestAuthUser,
  account: { isActive: boolean; role: NestAuthUser["role"] } | null,
): NestAuthUser | null {
  if (!account?.isActive) return null;
  return { ...tokenUser, role: account.role };
}

function headerString(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export function tokenFromFastifyRequest(headers: Record<string, unknown>): string | null {
  const authorization = headerString(headers.authorization ?? headers.Authorization);
  if (authorization && authorization.startsWith("Bearer ")) {
    const bearer = authorization.slice("Bearer ".length).trim();
    return bearer || null;
  }
  const cookie = headerString(headers.cookie ?? headers.Cookie);
  if (!cookie) return null;
  const match = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("pivotassist_session="));
  if (!match) return null;
  const value = match.slice("pivotassist_session=".length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
