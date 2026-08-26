import { IsString, Length } from 'class-validator';

/** Paso 3 del login (solo si la cuenta tiene 2FA activo) — el challenge token viaja en una cookie corta aparte, no en este body (ver `AuthController.loginStep3`). */
export class LoginTwoFactorDto {
  /** Código real de 6 dígitos TOTP, o uno de los 10 códigos de recuperación (formato distinto, más largo) — `AuthService` prueba ambos. */
  @IsString()
  @Length(6, 20)
  code: string;
}
