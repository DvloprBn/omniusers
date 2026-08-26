import { apiBaseUrl } from './client-api-url';

/**
 * `fetch` real desde el NAVEGADOR (Client Components — el formulario de
 * login en 3 pasos, por ejemplo). A diferencia de `serverFetch` (server.ts),
 * este NO redirige solo por un 401 — un 401 en el paso de login es un
 * resultado normal ("credenciales inválidas"), no una sesión expirada.
 */
export async function clientApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Error ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}
