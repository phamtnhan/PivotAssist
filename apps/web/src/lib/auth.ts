// REQ-0004 — session cookie pivotassist_session; tenant uses this identity. New login = REQ-0015 halt.
// REQ-0018 — JWT_SECRET fail-closed; no published fallback signer.
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@pivotassist/db";
import { jwtSecretKey } from "@/lib/jwt-secret";
import { SESSION_COOKIE_NAME } from "@/lib/session-paths";
import { asPreferences } from "@/lib/user-preferences";

export { SESSION_COOKIE_NAME };

export interface AuthUserPayload {
  userId: string;
  email: string;
  fullName: string;
  role: "CANDIDATE" | "RECRUITER" | "ADMIN";
  iat?: number;
}

/**
 * Hash a plain text password using bcrypt with 10 salt rounds
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare a plain text password against a bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically signed JWT session token (7 days validity)
 */
export async function createSessionToken(payload: AuthUserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecretKey());
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(token: string): Promise<AuthUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());
    if (payload.purpose === "2fa") return null;
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as "CANDIDATE" | "RECRUITER" | "ADMIN",
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

export async function createTwoFactorPendingToken(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(jwtSecretKey());
}

export async function verifyTwoFactorPendingToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());
    if (payload.purpose !== "2fa" || typeof payload.userId !== "string") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

/** Session user with centralized revocation check */
export async function getSessionUser(): Promise<AuthUserPayload | null> {
  return getCurrentUser();
}

/**
 * Retrieve the current authenticated user from request cookies
 */
export async function getCurrentUser(): Promise<AuthUserPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await verifySessionToken(token);
    if (!payload) return null;

    // Re-check the database so an admin lock or password revocation takes effect immediately
    const account = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true, email: true, fullName: true, role: true, preferencesJson: true },
    });
    if (!account?.isActive) return null;

    // Centralized JWT revocation on password change (FINDING-06)
    if (account.preferencesJson && typeof payload.iat === "number") {
      const prefs = asPreferences(account.preferencesJson);
      const passwordChangedAt =
        typeof prefs.passwordChangedAt === "number" ? prefs.passwordChangedAt : 0;
      const passwordChangedAtSec = Math.floor(passwordChangedAt / 1000);
      if (passwordChangedAtSec > 0 && payload.iat < passwordChangedAtSec) {
        return null;
      }
    }

    return {
      ...payload,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
    };
  } catch {
    return null;
  }
}

export { prisma };
