import { IsString } from 'class-validator';

/** Reusado por `disable` y `recovery-codes/regenerate` — ambas acciones debilitan 2FA, así que ambas re-exigen la contraseña actual (defensa contra una sesión secuestrada usando esto en silencio). */
export class CurrentPasswordDto {
  @IsString()
  currentPassword: string;
}
