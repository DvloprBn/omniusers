import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { escapeHtml } from '../common/utils/escape-html.util';

const LOGIN_THRESHOLD = 5;
const TWO_FACTOR_THRESHOLD = 5;
const WINDOW_SECONDS = 15 * 60;

interface RecordParams {
  /** Lo que se escribió en el campo real (correo en login, o el user_id ya autenticado en 2FA) — texto libre, NUNCA validado (ver nota real de seguridad abajo). */
  identifier: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Detección real de fuerza bruta — 3 puntos reales cubiertos: login
 * (contraseña), 2FA (código TOTP — un punto real que Espiral/Dely Doggy no
 * tenían, porque ninguno construyó 2FA), y reuso de un refresh token
 * robado.
 *
 * El conteo real vive en Redis con ventana deslizante — NUNCA se escribe
 * una fila en Postgres por cada intento fallido individual (sería ruido de
 * alguien que se equivocó una vez); solo al cruzar el umbral se escribe
 * una fila real y se manda UNA alerta por ventana (bandera `NX` en Redis).
 */
@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  /**
   * Cuenta un intento de login fallido (contraseña incorrecta o cuenta
   * inexistente/inactiva) — llamar SIEMPRE con el mismo `identifier` real
   * (el correo tal cual se escribió), nunca solo cuando la cuenta existe de
   * verdad (si no, un atacante podría usar "no genera evento" como oráculo
   * para enumerar correos válidos).
   */
  async recordFailedLogin(p: RecordParams): Promise<void> {
    try {
      const key = `security:login_fail:${p.identifier}`;
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, WINDOW_SECONDS);
      if (count < LOGIN_THRESHOLD) return;

      const windowBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
      await this.upsertAndMaybeAlert('login_bruteforce', p, count, windowBucket);
    } catch (e) {
      this.logger.error('Falló al registrar un intento de login fallido', e as Error);
    }
  }

  /**
   * Cuenta un código TOTP/de recuperación incorrecto en el paso 3 del login
   * (ver `AuthService.loginStep3`) — punto real de fuerza bruta que solo
   * existe porque este proyecto sí tiene 2FA real.
   */
  async recordFailedTwoFactor(p: RecordParams): Promise<void> {
    try {
      const key = `security:2fa_fail:${p.identifier}`;
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, WINDOW_SECONDS);
      if (count < TWO_FACTOR_THRESHOLD) return;

      const windowBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
      await this.upsertAndMaybeAlert('twofactor_bruteforce', p, count, windowBucket);
    } catch (e) {
      this.logger.error('Falló al registrar un intento fallido de 2FA', e as Error);
    }
  }

  /** Umbral 1 — un solo reuso real de un refresh token ya revocado es señal fuerte por sí sola, se escribe de inmediato, sin ventana de conteo. */
  async recordRefreshTokenReuse(p: RecordParams): Promise<void> {
    try {
      const windowBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
      await this.upsertAndMaybeAlert('refresh_token_reuse', p, 1, windowBucket);
    } catch (e) {
      this.logger.error('Falló al registrar una reutilización de refresh token', e as Error);
    }
  }

  private async upsertAndMaybeAlert(type: string, p: RecordParams, attempts: number, windowBucket: number): Promise<void> {
    const fingerprint = createHash('sha256').update(`${type}|${p.identifier}|${windowBucket}`).digest('hex');

    const existing = await this.prisma.security_events.findUnique({ where: { fingerprint } });
    if (existing) {
      await this.prisma.security_events.update({
        where: { fingerprint },
        data: { attempts, occurrence_count: { increment: 1 }, last_seen_at: new Date() },
      });
      return;
    }

    await this.prisma.security_events.create({
      data: { fingerprint, type, identifier: p.identifier, ip_address: p.ip, user_agent: p.userAgent, attempts },
    });

    const alertKey = `security:alert_sent:${fingerprint}`;
    const sent = await this.redis.set(alertKey, '1', 'EX', WINDOW_SECONDS, 'NX');
    if (sent !== 'OK') return;

    const TYPE_LABEL: Record<string, string> = {
      login_bruteforce: 'Fuerza bruta en login',
      twofactor_bruteforce: 'Fuerza bruta en 2FA',
      refresh_token_reuse: 'Reutilización de refresh token',
    };
    // escapeHtml desde el primer commit — p.identifier es SIEMPRE texto
    // libre no validado (en login_bruteforce es literalmente lo que se
    // escribió en el campo "correo" de un intento que FALLÓ, nunca pasó
    // por @IsEmail()) — lección real ya aprendida a la mala en Dely Doggy.
    const html = `<p><strong>${escapeHtml(p.identifier)}</strong> — ${attempts} intento(s), IP ${escapeHtml(p.ip ?? 'desconocida')}</p>`;
    await this.mail.notifyRoles(['admin', 'super'], `Alerta de seguridad: ${TYPE_LABEL[type] ?? type}`, html);
  }

  /** Lista real de eventos de seguridad (admin/super) — usado por `/security-events` en `SecurityEventsController`. */
  findAll(status?: string) {
    return this.prisma.security_events.findMany({
      where: status ? { status } : undefined,
      orderBy: { last_seen_at: 'desc' },
    });
  }
}
