import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Resend } from 'resend';
import { RESEND_CLIENT } from './mail.constants';
import { PrismaService } from '../prisma/prisma.service';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envío real de correo (Resend) — integración real desde el primer commit,
 * nunca simulada, siguiendo el mismo criterio de los proyectos hermanos.
 *
 * **Requiere `RESEND_API_KEY` real** (ver `.env.example`) — sin dominio
 * propio verificado en Resend, usa su remitente de pruebas
 * (`onboarding@resend.dev`), que SÍ manda correos reales (no es un
 * simulacro), pero solo a la cuenta dueña de la API key hasta que se
 * verifique un dominio real.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress = process.env.MAIL_FROM_ADDRESS ?? 'onboarding@resend.dev';

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Manda un correo real vía Resend. Nunca relanza el error — un correo que
   * falla no debe tumbar un flujo que ya de verdad pasó (ej. la cuenta ya
   * se creó); el caller decide qué hacer con el `false`.
   *
   * @returns `true` si Resend confirmó el envío, `false` si falló (red o rechazo de la API) — nunca lanza.
   */
  async send({ to, subject, html }: SendMailInput): Promise<boolean> {
    try {
      const { error } = await this.resend.emails.send({ from: this.fromAddress, to, subject, html });
      if (error) {
        this.logger.error(`Resend rechazó el correo a ${to} ("${subject}"): ${JSON.stringify(error)}`);
        return false;
      }
      this.logger.log(`Correo enviado a ${to}: "${subject}"`);
      return true;
    } catch (e) {
      this.logger.error(`Error de red/API enviando correo a ${to} ("${subject}")`, e as Error);
      return false;
    }
  }

  /**
   * Manda el mismo correo a TODAS las cuentas activas que tengan alguno de
   * los roles dados — usado por `SecurityEventsService` para avisar a
   * `admin`/`super` de un patrón real de fuerza bruta.
   *
   * @param roles Nombres reales de rol (ej. `['admin', 'super']`).
   */
  async notifyRoles(roles: string[], subject: string, html: string): Promise<void> {
    const recipients = await this.prisma.users.findMany({
      where: { roles: { name: { in: roles } }, is_active: true },
      select: { email: true },
    });
    for (const r of recipients) {
      await this.send({ to: r.email, subject, html });
    }
  }
}
