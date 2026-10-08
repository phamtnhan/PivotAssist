// REQ-0023 — APP_GUARD: 401 without a verified session; ignore client-supplied identity
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@pivotassist/db";
import { resolvedJwtSecret } from "./jwt-env.js";
import {
  nestUserAfterDbRecheck,
  tokenFromFastifyRequest,
  verifyHs256SessionToken,
} from "./jwt-verify.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers?: Record<string, unknown>; user?: unknown }>();
    const secret = resolvedJwtSecret();
    if (!secret) throw new UnauthorizedException("Authentication required.");
    const token = tokenFromFastifyRequest(request.headers ?? {});
    if (!token) throw new UnauthorizedException("Authentication required.");
    const user = verifyHs256SessionToken(token, secret);
    if (!user) throw new UnauthorizedException("Authentication required.");
    try {
      const account = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isActive: true, role: true, preferencesJson: true },
      });
      const refreshed = nestUserAfterDbRecheck(user, account);
      if (!refreshed) throw new UnauthorizedException("Authentication required.");

      // Check token revocation on password change (FINDING-06)
      if (account?.preferencesJson && typeof user.iat === "number") {
        const prefs = account.preferencesJson as Record<string, unknown>;
        const passwordChangedAt =
          typeof prefs.passwordChangedAt === "number" ? prefs.passwordChangedAt : 0;
        if (passwordChangedAt > 0 && user.iat * 1000 < passwordChangedAt) {
          throw new UnauthorizedException("Authentication required.");
        }
      }

      request.user = refreshed;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Authentication required.");
    }
  }
}
