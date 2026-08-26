import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload, AuthenticatedUser } from '../jwt-payload.interface';

/** El access token viaja en una cookie httpOnly (nunca en `localStorage` — un XSS podría leer `localStorage`, no una cookie httpOnly), así que se extrae de ahí en vez de un header `Authorization: Bearer ...`. */
function extractFromCookie(req: Request): string | null {
  return req?.cookies?.access_token ?? null;
}

/**
 * Valida el JWT de acceso real en cada request protegido — `passport-jwt`
 * ya verifica la FIRMA y la EXPIRACIÓN antes de siquiera llamar a
 * `validate()`; lo que hace este método es la parte que un JWT por sí solo
 * no puede garantizar: que la cuenta SIGA existiendo y activa AHORA MISMO,
 * no en el momento en que se firmó el token (hasta 15 minutos atrás).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET no está definido en las variables de entorno');
    }
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: secret,
      // Fija el algoritmo esperado explícito — nunca confiar en lo que el
      // propio token diga que usó (mitiga un ataque real de "confusión de
      // algoritmo", donde un atacante fuerza al servidor a verificar un
      // JWT firmado con HMAC usando la llave PÚBLICA de RS256 como secreto).
      algorithms: ['HS256'],
    });
  }

  /**
   * Se ejecuta en CADA request autenticado — a propósito consulta Postgres
   * en vivo (`role`/`must_change_password`/`is_active`) en vez de confiar
   * en el payload firmado del JWT: si alguien desactiva una cuenta o le
   * cambia el rol, eso debe surtir efecto AHORA, no hasta que su access
   * token expire solo.
   *
   * @throws {UnauthorizedException} si el payload es inválido, la cuenta ya no existe, o está desactivada.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.users.findUnique({
      where: { user_id: payload.sub },
      select: { is_active: true, must_change_password: true, roles: { select: { name: true } } },
    });
    if (!user || !user.is_active) {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.sub,
      role: user.roles.name,
      mustChangePassword: user.must_change_password,
    };
  }
}
