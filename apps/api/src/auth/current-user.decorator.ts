import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { NestAuthUser } from "./jwt-verify.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): NestAuthUser => {
    const request = context.switchToHttp().getRequest<{ user?: NestAuthUser }>();
    if (!request.user) {
      throw new Error("JwtAuthGuard must run before @CurrentUser()");
    }
    return request.user;
  },
);
