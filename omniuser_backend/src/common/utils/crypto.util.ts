import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Cifrado SIMÉTRICO real (AES-256-GCM) — a diferencia de `bcryptjs` (que
 * HASHEA una vía, usado para contraseñas/códigos de recuperación, nunca
 * reversible), esto es para el ÚNICO dato de este proyecto que el servidor
 * necesita poder leer de vuelta: `users.totp_secret_encrypted`. Verificar un
 * código TOTP requiere el secreto real en texto plano por un instante — un
 * hash no serviría para eso.
 *
 * La llave real vive en `TOTP_ENCRYPTION_KEY` (nunca la misma que
 * `JWT_SECRET` — son responsabilidades distintas, mezclarlas significa que
 * comprometer una compromete la otra). GCM es un modo autenticado: además
 * de cifrar, detecta si el valor guardado fue modificado (el `tag` no
 * cuadraría al descifrar).
 */
function getKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('TOTP_ENCRYPTION_KEY no está definida — hace falta para cifrar/descifrar el secreto TOTP');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('TOTP_ENCRYPTION_KEY debe ser exactamente 32 bytes en hex (64 caracteres) — usa: openssl rand -hex 32');
  }
  return key;
}

/**
 * Cifra un secreto TOTP real para guardarlo en `users.totp_secret_encrypted`.
 *
 * @returns Un string real `iv:tag:datosCifrados` (los 3 en hex) — el IV es aleatorio en CADA llamada, así que cifrar el mismo secreto dos veces da resultados distintos (evita que 2 cuentas con "coincidencia" de secreto se vean iguales en la base de datos).
 */
export function encryptTotpSecret(plainSecret: string): string {
  const iv = randomBytes(12); // 96 bits — el tamaño real recomendado para GCM
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Descifra un valor real producido por `encryptTotpSecret` — usado
 * exclusivamente en el instante de verificar un código TOTP (`AuthService`,
 * `TwoFactorService`), nunca se expone el resultado a ninguna respuesta
 * HTTP.
 *
 * @throws Error si el formato es inválido o el `authTag` no coincide (dato corrupto o manipulado).
 */
export function decryptTotpSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Formato inválido de secreto TOTP cifrado');
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
