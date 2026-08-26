import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';
import type { AuthenticatedUser } from '../jwt-payload.interface';

/**
 * Exige un access token real y válido (delegado a `JwtStrategy` vía
 * Passport) — y además bloquea, del lado del SERVIDOR, cualquier cuenta con
 * `must_change_password: true` en cualquier ruta que no esté marcada
 * explícitamente con `@AllowPendingPasswordChange()`.
 *
 * Esto último es a propósito, no cosmético: confiar solo en que el
 * frontend redirija a "/cambiar-password" deja el backend expuesto a
 * cualquier cliente HTTP directo (curl, Postman) que traiga una cuenta con
 * contraseña temporal y la use para llamar cualquier endpoint sin nunca
 * cambiarla.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: AuthenticatedUser | false, info: unknown, context: ExecutionContext): TUser {
    const authenticated = super.handleRequest(err, user, info, context) as AuthenticatedUser;

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authenticated.mustChangePassword && !allowPending) {
      throw new ForbiddenException('Debes cambiar tu contraseña temporal antes de continuar');
    }
    return authenticated as unknown as TUser;
  }
}
