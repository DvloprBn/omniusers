import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import ms from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/templates/password-reset.template';
import { SecurityEventsService } from '../security-events/security-events.service';
import { verifyTotp } from '../common/utils/totp.util';
import { decryptTotpSecret } from '../common/utils/crypto.util';
import type { JwtPayload, TwoFactorChallengePayload } from './jwt-payload.interface';

/**
 * Núcleo real de autenticación de OmniUser: registro público, login en 3
 * pasos (correo → contraseña → 2FA si aplica), refresh/logout, cambio y
 * recuperación de contraseña.
 *
 * Mismo mecanismo de seguridad ya probado y auditado 2 veces en los
 * proyectos hermanos (Espiral → Dely Doggy) — rotación de refresh token con
 * margen de gracia + revocación en cascada ante reuso fuera de esa
 * ventana — con UNA pieza real nueva: el paso 3 (2FA), que ningún proyecto
 * hermano tiene construido.
 */

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInMs: number;
  refreshTokenExpiresInMs: number;
}

/** Nombre real del rol que recibe cualquier cuenta creada por registro público — nunca `admin`/`super`, esas se crean aparte (ver `prisma/seed.ts` y `UsersService`). */
const DEFAULT_SELF_REGISTER_ROLE = 'usuario';

/** Margen de gracia en la rotación de refresh tokens (mismo valor real que los proyectos hermanos): 2 pestañas renovando casi al mismo tiempo no deben tronar con 401 solo por perder la carrera por unos segundos. */
const REFRESH_TOKEN_GRACE_MS = 30_000;

/** Vigencia del link de "olvidé mi contraseña" — suficiente para revisar el correo sin apuro, corta para no dejar un link válido flotando por días. */
const PASSWORD_RESET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/** Vigencia del "challenge token" real entre el paso 2 y el paso 3 del login — corta a propósito: si alguien deja el paso de contraseña completado y no vuelve, la ventana para intentar 2FA se cierra sola. */
const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  /** Mensaje IDÉNTICO para "no existe" y "contraseña incorrecta" — a propósito, evita que el login sirva de oráculo para enumerar correos reales (OWASP API2). */
  private readonly invalidCredentialsMessage = 'Credenciales inválidas';

  /**
   * Registro público — a diferencia de `loginStep2`, aquí SÍ es normal
   * decirle al usuario "ese correo ya está registrado" (flujo estándar de
   * cualquier alta de cuenta); el riesgo de enumeración de `loginStep2` es
   * distinto (usarlo como oráculo para adivinar credenciales YA VÁLIDAS),
   * no aplica aquí.
   *
   * @throws {ConflictException} si el correo ya tiene una cuenta real.
   */
  async register(
    email: string,
    password: string,
    name: string | undefined,
    meta: RequestMeta,
  ): Promise<{ tokens: TokenPair; user: { id: string; email: string; role: string } }> {
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ese correo ya está registrado');
    }

    const role = await this.prisma.roles.findUniqueOrThrow({ where: { name: DEFAULT_SELF_REGISTER_ROLE } });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.users.create({
      data: { email, password_hash: passwordHash, name, role_id: role.role_id },
    });

    const tokens = await this.issueTokenPair(user.user_id, role.name, meta);
    return { tokens, user: { id: user.user_id, email: user.email, role: role.name } };
  }

  /**
   * Paso 1 del login (UX estilo Google) — SOLO existe para que el frontend
   * tenga una razón real de avanzar de la pantalla de correo a la de
   * contraseña. Nunca revela si la cuenta existe: responde éxito siempre,
   * exista o no el correo (mismo criterio anti-enumeración que
   * `forgotPassword`) — la validación real de credenciales ocurre hasta
   * `loginStep2`.
   */
  async loginStep1(_email: string): Promise<{ ok: true }> {
    return { ok: true };
  }

  /**
   * Paso 2 del login: valida correo+contraseña. Si la cuenta NO tiene 2FA
   * activo, este paso YA emite la sesión real completa (login termina
   * aquí). Si SÍ tiene 2FA activo, emite en su lugar un `challenge token`
   * de corta vida — la sesión real NO se emite todavía, falta el paso 3.
   *
   * @throws {UnauthorizedException} credenciales inválidas o cuenta inactiva — mismo mensaje genérico en ambos casos.
   */
  async loginStep2(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<
    | { requiresTwoFactor: false; tokens: TokenPair; user: { id: string; email: string; role: string } }
    | { requiresTwoFactor: true; challengeToken: string; challengeTokenExpiresInMs: number }
  > {
    const user = await this.prisma.users.findUnique({ where: { email }, include: { roles: true } });

    if (!user || !user.is_active) {
      void this.securityEvents.recordFailedLogin({ identifier: email, ip: meta.ipAddress, userAgent: meta.userAgent });
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      void this.securityEvents.recordFailedLogin({ identifier: email, ip: meta.ipAddress, userAgent: meta.userAgent });
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    if (!user.totp_enabled) {
      const tokens = await this.issueTokenPair(user.user_id, user.roles.name, meta);
      return { requiresTwoFactor: false, tokens, user: { id: user.user_id, email: user.email, role: user.roles.name } };
    }

    const challengePayload: TwoFactorChallengePayload = { sub: user.user_id, purpose: 'two_factor_challenge' };
    const challengeToken = await this.jwtService.signAsync(challengePayload, { expiresIn: TWO_FACTOR_CHALLENGE_TTL_MS / 1000 });
    return { requiresTwoFactor: true, challengeToken, challengeTokenExpiresInMs: TWO_FACTOR_CHALLENGE_TTL_MS };
  }

  /**
   * Paso 3 del login (solo si `loginStep2` pidió 2FA): recibe el
   * `challenge token` real (emitido por `loginStep2`, viaja en una cookie
   * aparte — ver `AuthController`) más un código de 6 dígitos TOTP o uno de
   * los códigos de recuperación de un solo uso. Cualquiera de los 2 formatos
   * es válido — se prueba primero como TOTP (más común), luego como
   * recuperación.
   *
   * @throws {UnauthorizedException} challenge token inválido/expirado, cuenta sin 2FA activo, o código incorrecto.
   */
  async loginStep3(rawChallengeToken: string | undefined, code: string, meta: RequestMeta): Promise<{ tokens: TokenPair; user: { id: string; email: string; role: string } }> {
    if (!rawChallengeToken) {
      throw new UnauthorizedException();
    }

    let payload: TwoFactorChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<TwoFactorChallengePayload>(rawChallengeToken);
    } catch {
      throw new UnauthorizedException('El paso de contraseña expiró — vuelve a iniciar sesión.');
    }
    if (payload.purpose !== 'two_factor_challenge') {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.users.findUnique({ where: { user_id: payload.sub }, include: { roles: true } });
    if (!user || !user.is_active || !user.totp_enabled || !user.totp_secret_encrypted) {
      throw new UnauthorizedException();
    }

    const isValidTotp = verifyTotp(decryptTotpSecret(user.totp_secret_encrypted), code);
    const isValidRecoveryCode = isValidTotp ? false : await this.tryConsumeRecoveryCode(user.user_id, code);

    if (!isValidTotp && !isValidRecoveryCode) {
      void this.securityEvents.recordFailedTwoFactor({ identifier: user.user_id, ip: meta.ipAddress, userAgent: meta.userAgent });
      throw new UnauthorizedException('Código inválido');
    }

    const tokens = await this.issueTokenPair(user.user_id, user.roles.name, meta);
    return { tokens, user: { id: user.user_id, email: user.email, role: user.roles.name } };
  }

  /** Prueba `code` contra los códigos de recuperación reales, sin usar, de la cuenta — marca el primero que haga match como usado (un solo uso real, nunca se puede reutilizar). */
  private async tryConsumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const unused = await this.prisma.totp_recovery_codes.findMany({ where: { user_id: userId, used_at: null } });
    for (const candidate of unused) {
      if (await bcrypt.compare(code, candidate.code_hash)) {
        await this.prisma.totp_recovery_codes.update({ where: { code_id: candidate.code_id }, data: { used_at: new Date() } });
        return true;
      }
    }
    return false;
  }

  /**
   * Rota un refresh token real por uno nuevo. Implementa el mecanismo
   * completo de "ventana de gracia": si el token que llega YA estaba
   * revocado (ya se usó antes), pero fue hace menos de
   * `REFRESH_TOKEN_GRACE_MS`, se asume una carrera real entre 2 pestañas
   * renovando casi al mismo tiempo (no un robo) y se deja pasar igual. Si
   * pasó más tiempo que eso, es la señal real de que alguien más ya usó
   * este token para robar la sesión — se revocan TODAS las sesiones de esa
   * cuenta de una vez, no solo esta.
   *
   * @throws {UnauthorizedException} token ausente, no encontrado, expirado, o reuso fuera de la ventana de gracia.
   */
  async refresh(rawRefreshToken: string | undefined, meta: RequestMeta): Promise<TokenPair> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException();
    }
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const existing = await this.prisma.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
      include: { users: { include: { roles: true } } },
    });

    if (!existing || existing.expires_at < new Date()) {
      throw new UnauthorizedException();
    }

    if (existing.revoked) {
      const withinGrace = existing.used_at && Date.now() - existing.used_at.getTime() <= REFRESH_TOKEN_GRACE_MS;
      if (!withinGrace) {
        await this.prisma.refresh_tokens.updateMany({
          where: { user_id: existing.user_id, revoked: false },
          data: { revoked: true },
        });
        void this.securityEvents.recordRefreshTokenReuse({ identifier: existing.users.email, ip: meta.ipAddress, userAgent: meta.userAgent });
        throw new UnauthorizedException();
      }
      return this.issueTokenPair(existing.users.user_id, existing.users.roles.name, meta);
    }

    await this.prisma.refresh_tokens.update({
      where: { token_id: existing.token_id },
      data: { revoked: true, used_at: new Date() },
    });

    return this.issueTokenPair(existing.users.user_id, existing.users.roles.name, meta);
  }

  /** Revoca el refresh token real de esta sesión — no lanza si ya no existe/ya estaba revocado (logout siempre "funciona" desde el punto de vista del cliente). */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.refresh_tokens.updateMany({
      where: { token_hash: tokenHash, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * Cambia la contraseña de una cuenta YA AUTENTICADA — revoca TODOS sus
   * refresh tokens activos al terminar (si alguien más tenía una sesión
   * abierta con la contraseña vieja, o la robó, queda fuera en su próximo
   * intento de refresh).
   *
   * @throws {UnauthorizedException} si `currentPassword` no coincide con la real.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.users.findUnique({ where: { user_id: userId } });
    if (!user) throw new UnauthorizedException();

    const currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentMatches) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { user_id: userId }, data: { password_hash: newPasswordHash, must_change_password: false } }),
      this.prisma.refresh_tokens.updateMany({ where: { user_id: userId, revoked: false }, data: { revoked: true } }),
    ]);
  }

  /**
   * "Olvidé mi contraseña" — nunca revela si el correo existe o no (OWASP:
   * enumeración de usuarios): este método nunca lanza ni regresa nada
   * distinto según el caso; el controller siempre da el mismo mensaje
   * genérico sin importar lo que pase aquí adentro.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user || !user.is_active) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      // Cualquier link anterior sin usar de esta cuenta se invalida — un
      // correo con typo o alguien pidiendo el reset varias veces no debe
      // dejar 2 links válidos flotando a la vez.
      this.prisma.password_reset_tokens.deleteMany({ where: { user_id: user.user_id, used_at: null } }),
      this.prisma.password_reset_tokens.create({
        data: { user_id: user.user_id, token_hash: this.hashResetToken(rawToken), expires_at: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS) },
      }),
    ]);

    const resetUrl = `${process.env.FRONTEND_URL}/restablecer-password?token=${rawToken}`;
    const { subject, html } = passwordResetEmail({ name: user.name, resetUrl });
    await this.mail.send({ to: user.email, subject, html });
  }

  /**
   * Consume el token real del link de reset — un solo uso (`used_at`).
   * Revoca todos los refresh tokens igual que `changePassword`: cualquier
   * sesión vieja (legítima o robada) queda cerrada.
   *
   * @throws {BadRequestException} token no encontrado, ya usado, o expirado.
   */
  async resetPasswordWithToken(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashResetToken(rawToken);
    const record = await this.prisma.password_reset_tokens.findUnique({ where: { token_hash: tokenHash } });
    if (!record || record.used_at || record.expires_at < new Date()) {
      throw new BadRequestException('Este link ya no es válido — pide que te reenvíen el correo.');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { user_id: record.user_id }, data: { password_hash: newPasswordHash, must_change_password: false } }),
      this.prisma.password_reset_tokens.update({ where: { token_id: record.token_id }, data: { used_at: new Date() } }),
      this.prisma.refresh_tokens.updateMany({ where: { user_id: record.user_id, revoked: false }, data: { revoked: true } }),
    ]);
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Perfil real de la cuenta autenticada — usado por `GET /auth/me`. */
  async getProfile(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { user_id: userId },
      include: { roles: { select: { name: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Esta cuenta ya no existe');
    }
    return {
      userId: user.user_id,
      role: user.roles.name,
      name: user.name,
      email: user.email,
      must_change_password: user.must_change_password,
      totp_enabled: user.totp_enabled,
    };
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Emite un par real de tokens de sesión (access JWT + refresh opaco) y persiste el refresh token (hasheado) — el único punto real donde una sesión completa nace. */
  private async issueTokenPair(userId: string, role: string, meta: RequestMeta): Promise<TokenPair> {
    const accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
    const refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

    const payload: JwtPayload = { sub: userId, role };
    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: accessTokenExpiresIn as ms.StringValue });

    // El refresh token NO es un JWT — solo un valor aleatorio de alta
    // entropía. Solo se guarda su HASH en la BD, nunca el valor real.
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiresInMs = ms(refreshTokenExpiresIn as ms.StringValue);

    await this.prisma.refresh_tokens.create({
      data: {
        user_id: userId,
        token_hash: this.hashRefreshToken(rawRefreshToken),
        expires_at: new Date(Date.now() + refreshTokenExpiresInMs),
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      accessTokenExpiresInMs: ms(accessTokenExpiresIn as ms.StringValue),
      refreshTokenExpiresInMs,
    };
  }
}
