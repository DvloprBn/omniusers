import { randomBytes } from 'crypto';
import { encryptTotpSecret, decryptTotpSecret } from './crypto.util';

describe('crypto.util (cifrado simétrico real del secreto TOTP)', () => {
  const originalKey = process.env.TOTP_ENCRYPTION_KEY;

  beforeAll(() => {
    // Llave real de 32 bytes en hex — SOLO para esta prueba, nunca la llave
    // real del proyecto (esa vive en .env, fuera de git).
    process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    process.env.TOTP_ENCRYPTION_KEY = originalKey;
  });

  it('cifra y descifra un secreto real de vuelta al valor original exacto', () => {
    const secretoReal = 'JBSWY3DPEHPK3PXP';
    const cifrado = encryptTotpSecret(secretoReal);
    expect(decryptTotpSecret(cifrado)).toBe(secretoReal);
  });

  it('el mismo secreto real cifrado 2 veces da resultados DISTINTOS (IV aleatorio real cada vez)', () => {
    const secretoReal = 'JBSWY3DPEHPK3PXP';
    const cifrado1 = encryptTotpSecret(secretoReal);
    const cifrado2 = encryptTotpSecret(secretoReal);
    expect(cifrado1).not.toBe(cifrado2);
    // Pero ambos descifran al mismo valor real.
    expect(decryptTotpSecret(cifrado1)).toBe(secretoReal);
    expect(decryptTotpSecret(cifrado2)).toBe(secretoReal);
  });

  it('rechaza descifrar un valor manipulado — el authTag real de GCM detecta la manipulación', () => {
    const cifrado = encryptTotpSecret('JBSWY3DPEHPK3PXP');
    const [iv, tag, datos] = cifrado.split(':');
    // Cambia un solo caracter real de los datos cifrados — simula una
    // manipulación real (ej. alguien editando la fila directo en Postgres).
    const datosManipulados = (datos[0] === 'a' ? 'b' : 'a') + datos.slice(1);
    const cifradoManipulado = [iv, tag, datosManipulados].join(':');
    expect(() => decryptTotpSecret(cifradoManipulado)).toThrow();
  });

  it('rechaza un formato real inválido (sin los 3 segmentos esperados)', () => {
    expect(() => decryptTotpSecret('esto-no-tiene-el-formato-real')).toThrow('Formato inválido');
  });

  it('lanza un error real y claro si TOTP_ENCRYPTION_KEY no está definida', () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    expect(() => encryptTotpSecret('cualquier-cosa')).toThrow('TOTP_ENCRYPTION_KEY no está definida');
    process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString('hex'); // restaura para las pruebas siguientes
  });

  it('lanza un error real y claro si TOTP_ENCRYPTION_KEY no mide 32 bytes reales', () => {
    process.env.TOTP_ENCRYPTION_KEY = 'muy-corta';
    expect(() => encryptTotpSecret('cualquier-cosa')).toThrow('debe ser exactamente 32 bytes');
  });
});
