/**
 * Escapa los 5 caracteres reales que pueden inyectar HTML/atributos si un
 * dato de texto libre (ej. `users.name`, que cualquier persona escribe al
 * registrarse) se interpola sin escapar dentro de un correo HTML.
 *
 * Aplicado desde el primer commit de este proyecto — lección real ya
 * aprendida a la mala en Dely Doggy (ver
 * `DocumentacionProyecto/Bridge/LECCIONES_ARQUITECTURA.md`): un nombre real
 * como `<img src=x onerror=...>` capturado en un formulario y luego
 * interpolado crudo en un correo real es un XSS real contra quien lo abre.
 *
 * @param s Texto libre potencialmente peligroso (nunca confiar en que "ya viene limpio").
 * @returns El mismo texto, con `& < > " '` convertidos a sus entidades HTML — seguro de interpolar en un `<div>`/`<td>`/etc.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
