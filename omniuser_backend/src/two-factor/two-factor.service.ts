import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { generateTotpSecret, totpKeyUri, verifyTotp } from '../common/utils/totp.util';
import { encryptTotpSecret, decryptTotpSecret } from '../common/utils/crypto.util';

/** Cuántos códigos de recuperación de un solo uso se generan cada vez (al activar 2FA, o al regenerar) — 10 es el número real que usan Google/GitHub/etc., suficiente para no quedarse sin ninguno en un uso normal. */
const RECOVERY_CODES_COUNT = 10;

/**
 * Setup, confirmación y administración real de 2FA (TOTP, RFC 6238) — pieza
 * genuinamente nueva de este proyecto, sin precedente en Espiral/Dely
 * Doggy. Todas las funciones aquí requieren una sesión YA autenticada
 * (`JwtAuthGuard` en el controller) — nunca se puede activar/desactivar 2FA
 * de una cuenta ajena.
 */
@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inicia el setup real: genera un secreto TOTP nuevo, lo guarda cifrado
   * de una vez (con `totp_enabled` todavía en `false` — no se activa hasta
   * `confirmSetup`), y regresa el QR real (como data URI PNG) más el
   * secreto en texto para captura manual (por si el usuario no puede
   * escanear el QR).
   *
   * Llamar `setup()` de nuevo antes de confirmar simplemente reemplaza el
   * secreto pendiente anterior — no hay ningún efecto real hasta que se
   * confirma con un código válido.
   *
   * @throws {BadRequestException} si la cuenta ya tiene 2FA activo (hay que desactivarlo primero, nunca "resetupear" por encima de uno ya activo).
   */
  async setup(userId: string, accountEmail: string): Promise<{ qrCodeDataUrl: string; secret: string }> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { user_id: userId } });
    if (user.totp_enabled) {
      throw new BadRequestException('Esta cuenta ya tiene 2FA activo — desactívalo antes de configurar uno nuevo.');
    }

    const secret = generateTotpSecret();
    await this.prisma.users.update({ where: { user_id: userId }, data: { totp_secret_encrypted: encryptTotpSecret(secret) } });

    const uri = totpKeyUri(secret, accountEmail);
    const qrCodeDataUrl = await QRCode.toDataURL(uri);
    return { qrCodeDataUrl, secret };
  }

  /**
   * Confirma el setup: valida que el código que el usuario ya escribió en
   * su app de 2FA coincida con el secreto pendiente — solo si coincide se
   * activa `totp_enabled: true` de verdad y se generan los 10 códigos de
   * recuperación reales (se muestran UNA sola vez en la respuesta; a partir
   * de aquí solo se guardan hasheados, nunca se pueden volver a consultar).
   *
   * @throws {BadRequestException} si no hay un setup pendiente, o el código no coincide con el secreto pendiente.
   */
  async confirmSetup(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { user_id: userId } });
    if (!user.totp_secret_encrypted) {
      throw new BadRequestException('No hay un setup de 2FA pendiente — llama a /two-factor/setup primero.');
    }

    const secret = decryptTotpSecret(user.totp_secret_encrypted);
    if (!verifyTotp(secret, code)) {
      throw new BadRequestException('El código no coincide — revisa la hora de tu teléfono e inténtalo de nuevo.');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { user_id: userId }, data: { totp_enabled: true } }),
      this.prisma.totp_recovery_codes.deleteMany({ where: { user_id: userId } }),
      this.prisma.totp_recovery_codes.createMany({
        data: await this.hashRecoveryCodes(userId, recoveryCodes),
      }),
    ]);

    return { recoveryCodes };
  }

  /**
   * Desactiva 2FA — exige la contraseña actual (defensa real: una sesión
   * secuestrada, sin la contraseña, no puede quitarle el segundo factor a
   * la cuenta en silencio). Borra el secreto y todos los códigos de
   * recuperación reales.
   *
   * @throws {UnauthorizedException} si `currentPassword` no coincide.
   */
  async disable(userId: string, currentPassword: string): Promise<void> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { user_id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    await this.prisma.$transaction([
      this.prisma.users.update({ where: { user_id: userId }, data: { totp_enabled: false, totp_secret_encrypted: null } }),
      this.prisma.totp_recovery_codes.deleteMany({ where: { user_id: userId } }),
    ]);
  }

  /**
   * Invalida TODOS los códigos de recuperación reales y genera 10 nuevos —
   * para cuando el usuario sospecha que alguien más los vio, o simplemente
   * ya usó varios. Misma exigencia de contraseña que `disable`.
   *
   * @throws {UnauthorizedException} si `currentPassword` no coincide, o si la cuenta no tiene 2FA activo.
   */
  async regenerateRecoveryCodes(userId: string, currentPassword: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { user_id: userId } });
    if (!user.totp_enabled) {
      throw new UnauthorizedException('Esta cuenta no tiene 2FA activo');
    }
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.totp_recovery_codes.deleteMany({ where: { user_id: userId } }),
      this.prisma.totp_recovery_codes.createMany({ data: await this.hashRecoveryCodes(userId, recoveryCodes) }),
    ]);
    return { recoveryCodes };
  }

  /** Formato real `XXXX-XXXX` (8 caracteres hex en mayúsculas, con guion) — legible para copiar a mano, suficiente entropía (32 bits) para un código de un solo uso ya limitado por intentos (ver `SecurityEventsService.recordFailedTwoFactor`). */
  private generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODES_COUNT }, () => {
      const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    });
  }

  private async hashRecoveryCodes(userId: string, codes: string[]) {
    return Promise.all(codes.map(async (code) => ({ user_id: userId, code_hash: await bcrypt.hash(code, 12) })));
  }
}
