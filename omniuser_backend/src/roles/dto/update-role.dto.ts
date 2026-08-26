import { IsOptional, IsString, Length } from 'class-validator';

/** El `name` de un rol `is_system` (ej. "admin") no se puede renombrar — ver `RolesService.update` — para no romper todos los `@Roles('admin')` ya escritos en el código. */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;
}
