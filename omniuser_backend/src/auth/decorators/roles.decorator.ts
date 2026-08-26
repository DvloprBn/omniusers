import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Declara qué nombres de rol reales pueden entrar a un endpoint — evaluado por `RolesGuard`, SIEMPRE después de `JwtAuthGuard`. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
