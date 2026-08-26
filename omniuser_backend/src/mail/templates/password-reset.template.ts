import { escapeHtml } from '../../common/utils/escape-html.util';

/**
 * Construye el correo real de "olvidé mi contraseña".
 *
 * @param params.name Nombre real de la cuenta (texto libre — puede ser `null` si la cuenta no lo capturó) — se escapa antes de interpolar (ver `escapeHtml`).
 * @param params.resetUrl Link real y de un solo uso hacia `/restablecer-password?token=...` (ver `AuthService.forgotPassword`).
 * @returns `{ subject, html }` listos para `MailService.send`.
 */
export function passwordResetEmail(params: { name: string | null; resetUrl: string }): { subject: string; html: string } {
  const name = params.name ? escapeHtml(params.name) : null;
  return {
    subject: 'Restablecer tu contraseña — OmniUser',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
        <h1 style="font-size:20px;">Restablecer tu contraseña</h1>
        <p>Hola${name ? `, ${name}` : ''} — pediste restablecer tu contraseña.</p>
        <p><a href="${params.resetUrl}" style="display:inline-block;margin:12px 0;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;">Elegir nueva contraseña</a></p>
        <p style="font-size:13px;color:#6b7280;">Este link es válido por 2 horas y solo funciona una vez. Si no pediste este cambio, ignora este correo — tu cuenta sigue segura.</p>
      </div>
    `,
  };
}
