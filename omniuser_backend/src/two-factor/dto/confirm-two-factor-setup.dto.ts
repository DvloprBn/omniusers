import { IsString, Length } from 'class-validator';

export class ConfirmTwoFactorSetupDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
