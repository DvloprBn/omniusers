import { IsInt, IsOptional, IsPositive, IsString, Length, Min } from 'class-validator';

/** El `name`/`level`/`max_count` de un rol `is_system` (ej. "admin") no se pueden cambiar — ver `RolesService.update` — para no romper los `@Roles('admin')` ya escritos ni la jerarquía real de la que depende `UsersService`. */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  max_count?: number;
}
