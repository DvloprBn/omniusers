import { IsEmail, IsInt, IsOptional, IsString, Length } from 'class-validator';

/** Alta administrativa real — a diferencia de `RegisterDto` (autoregistro público), esta la usa un `admin`/`super` para crear cuentas con CUALQUIER rol, incluido otro `admin`. */
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsInt()
  role_id: number;
}
