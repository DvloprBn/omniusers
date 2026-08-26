import { Global, Module } from '@nestjs/common';
import { Resend } from 'resend';
import { MailService } from './mail.service';
import { RESEND_CLIENT } from './mail.constants';

/**
 * `@Global()` — cualquier módulo manda correos sin reimportar este. Falla
 * rápido y visible al ARRANCAR el backend si falta `RESEND_API_KEY` (mejor
 * un error claro en el arranque que un 500 silencioso a medio flujo real
 * de "olvidé mi contraseña").
 */
@Global()
@Module({
  providers: [
    {
      provide: RESEND_CLIENT,
      useFactory: () => {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          throw new Error('RESEND_API_KEY no está definida — hace falta para poder mandar correos con Resend');
        }
        return new Resend(apiKey);
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
