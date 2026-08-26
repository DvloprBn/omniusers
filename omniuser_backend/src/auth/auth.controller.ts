import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginStep1Dto } from './dto/login-step1.dto';
import { LoginStep2Dto } from './dto/login-step2.dto';
import { LoginTwoFactorDto } from './dto/login-two-factor.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AllowPendingPasswordChange } from './decorators/allow-pending-password-change.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './jwt-payload.interface';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';
/** Cookie real y aparte para el challenge de 2FA — nunca reusa `access_token`/`refresh_token` (esos nombres implican "sesión real ya emitida", este NO lo es todavía). */
const TWO_FACTOR_CHALLENGE_COOKIE = 'two_factor_challenge';

/**
 * Endpoints reales de autenticación — login expuesto en 3 pasos reales
 * (`/auth/login/step1` → `/auth/login/step2` → `/auth/login/2fa`, solo si
 * la cuenta tiene 2FA activo), reproduciendo la UX de Google pedida para
 * este proyecto (ver `PLAN_DESARROLLO.md` §4).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  // Límite contra creación masiva de cuentas — ventana de horas (el abuso
  // real aquí es registrar muchas cuentas seguidas), no de segundos.
  @Throttle({ default: { limit: 10, ttl: seconds(3600) } })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.authService.register(dto.email, dto.password, dto.name, this.requestMeta(req));
    this.setSessionCookies(res, tokens);
    return { user };
  }

  @Post('login/step1')
  @HttpCode(200)
  async loginStep1(@Body() dto: LoginStep1Dto) {
    return this.authService.loginStep1(dto.email);
  }

  @Post('login/step2')
  @HttpCode(200)
  // Límite estricto por IP contra fuerza bruta de contraseña (OWASP API2) —
  // 5 intentos por minuto es suficiente para un humano que se equivoca, no
  // para un script probando una lista.
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async loginStep2(@Body() dto: LoginStep2Dto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginStep2(dto.email, dto.password, this.requestMeta(req));
    if (!result.requiresTwoFactor) {
      this.setSessionCookies(res, result.tokens);
      return { requiresTwoFactor: false, user: result.user };
    }
    this.setChallengeCookie(res, result.challengeToken, result.challengeTokenExpiresInMs);
    return { requiresTwoFactor: true };
  }

  @Post('login/2fa')
  @HttpCode(200)
  // Mismo límite real que el paso de contraseña — un código de 6 dígitos
  // es un blanco real de fuerza bruta si no se limita.
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async loginTwoFactor(@Body() dto: LoginTwoFactorDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.authService.loginStep3(req.cookies?.[TWO_FACTOR_CHALLENGE_COOKIE], dto.code, this.requestMeta(req));
    this.clearChallengeCookie(res);
    this.setSessionCookies(res, tokens);
    return { user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.refresh(req.cookies?.[REFRESH_COOKIE], this.requestMeta(req));
    this.setSessionCookies(res, tokens);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearSessionCookies(res);
    return { ok: true };
  }

  // Límite contra bombardear el correo de alguien más con avisos de
  // "restablece tu contraseña" — ventana de horas, mismo criterio que register.
  @Throttle({ default: { limit: 5, ttl: seconds(3600) } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Mensaje IDÉNTICO exista o no la cuenta — mismo motivo real que loginStep2.
    return { message: 'Si el correo existe, te llegó un link para restablecer tu contraseña.' };
  }

  // El token de 256 bits ya es computacionalmente infeasible de adivinar
  // por fuerza bruta — este límite es defensa en profundidad, no la
  // protección real.
  @Throttle({ default: { limit: 10, ttl: seconds(3600) } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPasswordWithToken(dto.token, dto.newPassword);
    return { ok: true };
  }

  // Ambas exentas del bloqueo por contraseña temporal (ver JwtAuthGuard) a
  // propósito: sin /me la UI ni siquiera sabría que debe redirigir a
  // cambiar la contraseña, y sin /me/password la cuenta no tendría forma
  // de arreglarse a sí misma.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.userId);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  private requestMeta(req: Request) {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }

  private setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string; accessTokenExpiresInMs: number; refreshTokenExpiresInMs: number }) {
    const isProd = process.env.NODE_ENV === 'production';
    // httpOnly: inaccesible desde JavaScript del navegador (mitiga robo vía
    // XSS). sameSite 'lax': viaja en requests same-site pero no en
    // navegación cross-site. secure: solo por HTTPS en producción. domain:
    // en dev se omite (host exacto que la puso); en prod se fija al
    // dominio padre para que funcione igual en api.<dominio> y <dominio>.
    const common = { httpOnly: true, sameSite: 'lax' as const, secure: isProd, domain: isProd ? `.${process.env.DOMAIN}` : undefined };
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...common, maxAge: tokens.accessTokenExpiresInMs });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...common, maxAge: tokens.refreshTokenExpiresInMs, path: '/auth' });
  }

  private clearSessionCookies(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = isProd ? `.${process.env.DOMAIN}` : undefined;
    res.clearCookie(ACCESS_COOKIE, { domain });
    res.clearCookie(REFRESH_COOKIE, { domain, path: '/auth' });
  }

  private setChallengeCookie(res: Response, token: string, maxAge: number) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(TWO_FACTOR_CHALLENGE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      domain: isProd ? `.${process.env.DOMAIN}` : undefined,
      maxAge,
      path: '/auth',
    });
  }

  private clearChallengeCookie(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(TWO_FACTOR_CHALLENGE_COOKIE, { domain: isProd ? `.${process.env.DOMAIN}` : undefined, path: '/auth' });
  }
}
