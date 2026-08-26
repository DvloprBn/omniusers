import { IsEmail, IsString } from 'class-validator';

/** Paso 2 del login: correo + contraseña. Si la cuenta no tiene 2FA activo, este paso YA emite la sesión real. */
export class LoginStep2Dto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
