import { authenticator } from 'otplib';

/**
 * Funciones puras reales de TOTP (RFC 6238) — sin ninguna dependencia de
 * NestJS/Prisma a propósito, para que tanto `AuthService` (verificar en el
 * paso 3 del login) como `TwoFactorService` (generar/confirmar el setup)
 * las puedan usar directo sin crear una dependencia circular entre esos 2
 * módulos (ver `DOCUMENTO_VIVO_ARQUITECTURA.md`).
 *
 * `otplib` ya implementa el algoritmo real del RFC — no se reinventa nada
 * aquí, solo se envuelve con nombres reales del dominio de este proyecto.
 */

/** Genera un secreto real nuevo (base32, el formato que espera cualquier app de 2FA) — usado UNA vez al iniciar el setup de una cuenta. */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Construye la URI real `otpauth://...` que una app de 2FA (Google
 * Authenticator/Authy/1Password) escanea como código QR — nunca se muestra
 * el secreto crudo al usuario, solo este URI codificado como QR (ver
 * `TwoFactorService.setup`).
 */
export function totpKeyUri(secret: string, accountLabel: string, issuer = 'OmniUser'): string {
  return authenticator.keyuri(accountLabel, issuer, secret);
}

/** Verifica un código de 6 dígitos real contra el secreto — `otplib` ya tolera el desfase de reloj típico (±1 paso de 30s) entre el teléfono y el servidor. */
export function verifyTotp(secret: string, code: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
