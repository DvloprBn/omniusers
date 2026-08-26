import { authenticator } from 'otplib';
import { generateTotpSecret, totpKeyUri, verifyTotp } from './totp.util';

describe('totp.util (RFC 6238 real, vía otplib)', () => {
  it('generateTotpSecret produce un secreto real distinto cada vez', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it('totpKeyUri produce una URI real otpauth:// con el correo y el emisor correctos', () => {
    const secret = generateTotpSecret();
    const uri = totpKeyUri(secret, 'cuenta@ejemplo.com', 'OmniUser');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('OmniUser');
    expect(decodeURIComponent(uri)).toContain('cuenta@ejemplo.com');
  });

  it('verifyTotp acepta el código real que el propio secreto genera en este instante', () => {
    const secret = generateTotpSecret();
    const codigoReal = authenticator.generate(secret);
    expect(verifyTotp(secret, codigoReal)).toBe(true);
  });

  it('verifyTotp rechaza un código real de OTRO secreto — hallazgo real que probaría un bug de "cualquier código pasa"', () => {
    const secretReal = generateTotpSecret();
    const secretDistinto = generateTotpSecret();
    const codigoDelOtroSecreto = authenticator.generate(secretDistinto);
    expect(verifyTotp(secretReal, codigoDelOtroSecreto)).toBe(false);
  });

  it('verifyTotp rechaza un código con formato inválido sin tronar (nunca debe lanzar)', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'no-es-un-codigo')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('verifyTotp rechaza un secreto real pero corrupto sin tronar', () => {
    expect(verifyTotp('secreto-invalido-no-base32!!!', '123456')).toBe(false);
  });
});
