import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../jwt-payload.interface';

/** Azúcar sintáctica: `@CurrentUser()` en vez de leer `request.user` a mano — `JwtStrategy.validate()` es quien lo llena de verdad. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
