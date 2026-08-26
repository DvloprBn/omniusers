import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { ConfirmTwoFactorSetupDto } from './dto/confirm-two-factor-setup.dto';
import { CurrentPasswordDto } from './dto/current-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

/** Sin `@Roles(...)` a propósito — cualquier cuenta autenticada administra SU PROPIO 2FA, sin importar el rol. */
@Controller('two-factor')
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('setup')
  async setup(@CurrentUser() user: AuthenticatedUser) {
    // El email real de la cuenta va en el QR (identifica la cuenta dentro
    // de la app de 2FA del usuario, ej. "OmniUser (correo@ejemplo.com)").
    const account = await this.prisma.users.findUniqueOrThrow({ where: { user_id: user.userId }, select: { email: true } });
    return this.twoFactor.setup(user.userId, account.email);
  }

  @Post('confirm-setup')
  confirmSetup(@Body() dto: ConfirmTwoFactorSetupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.twoFactor.confirmSetup(user.userId, dto.code);
  }

  @Post('disable')
  disable(@Body() dto: CurrentPasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.twoFactor.disable(user.userId, dto.currentPassword);
  }

  @Post('recovery-codes/regenerate')
  regenerateRecoveryCodes(@Body() dto: CurrentPasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.twoFactor.regenerateRecoveryCodes(user.userId, dto.currentPassword);
  }
}
