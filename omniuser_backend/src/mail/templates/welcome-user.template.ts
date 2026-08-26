import { escapeHtml } from '../../common/utils/escape-html.util';

/** Correo real de bienvenida cuando un `admin`/`super` da de alta una cuenta a mano (ver `UsersService.create`) — nunca se manda cuando alguien se autoregistra (`AuthService.register`), ahí no hay contraseña temporal que comunicar. */
export function welcomeUserEmail(params: { name: string | null; email: string; tempPassword: string; loginUrl: string }): { subject: string; html: string } {
  const name = params.name ? escapeHtml(params.name) : null;
  return {
    subject: 'Tu cuenta en OmniUser',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
        <h1 style="font-size:20px;">¡Bienvenido${name ? `, ${name}` : ''}!</h1>
        <p>Se creó tu cuenta.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f3f4f6;border-radius:8px;">
          <tr><td style="padding:8px 12px;">Correo</td><td style="padding:8px 12px;font-weight:bold;">${escapeHtml(params.email)}</td></tr>
          <tr><td style="padding:8px 12px;">Contraseña temporal</td><td style="padding:8px 12px;font-weight:bold;">${escapeHtml(params.tempPassword)}</td></tr>
        </table>
        <p>Por seguridad, se te pedirá cambiarla la primera vez que inicies sesión.</p>
        <p><a href="${params.loginUrl}" style="color:#2563eb;">Iniciar sesión</a></p>
      </div>
    `,
  };
}
