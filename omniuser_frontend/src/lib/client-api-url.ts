/**
 * URL real del backend, calculada del mismo host que sirvió la página
 * actual — funciona igual entrando por `localhost`, por la IP de la red
 * local, o por el dominio real en producción, sin tener que elegir uno de
 * antemano. Solo para uso del NAVEGADOR (`window` no existe en el
 * servidor) — código de servidor siempre usa `INTERNAL_API_URL` en su
 * lugar (ver `lib/api.ts`).
 */
export function apiBaseUrl(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL ?? '';

  const { protocol, hostname } = window.location;
  const isLocalNetwork = hostname === 'localhost' || hostname === '127.0.0.1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

  if (isLocalNetwork) {
    return `${protocol}//${hostname}:3030`;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? `${protocol}//${hostname}:3030`;
}
