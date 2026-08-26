import { IsEmail } from 'class-validator';

/** Paso 1 del login (UX estilo Google): solo el correo. */
export class LoginStep1Dto {
  @IsEmail()
  email: string;
}
