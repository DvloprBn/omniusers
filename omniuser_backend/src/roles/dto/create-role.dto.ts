import { IsInt, IsOptional, IsPositive, IsString, Length, Min } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Length(2, 50)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;

  /** Nivel real de jerarquía — `RolesService.create` rechaza crear un rol de nivel igual/mayor al de quien lo crea (ver `assertLevelBelowActor`). Default 0 (sin autoridad de gestión) si se omite. */
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number;

  /** Tope real de cuentas activas con este rol — omitir = sin límite. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  max_count?: number;
}
