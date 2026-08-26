import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../jwt-payload.interface';

/**
 * Mitigación directa de OWASP API5 (Broken Function Level Authorization):
 * que un endpoint exista y el request esté autenticado no basta — el ROL
 * real se revisa explícito aquí. SIEMPRE debe correr DESPUÉS de
 * `JwtAuthGuard` en el arreglo de `@UseGuards(...)` (necesita
 * `request.user` ya poblado).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /** @returns `true` si el endpoint no declaró `@Roles(...)` (solo exige estar autenticado) o si el rol real del usuario está en la lista permitida. */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const user: AuthenticatedUser = context.switchToHttp().getRequest().user;
    return requiredRoles.includes(user?.role);
  }
}
