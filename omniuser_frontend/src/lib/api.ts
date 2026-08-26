import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/** Solo para Server Components/Actions (corren DENTRO del contenedor `omniuser_frontend`) — `localhost:3030` no resuelve ahí, es la dirección que solo existe fuera de Docker. */
export const INTERNAL_API_URL = process.env.INTERNAL_API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * DAL mínimo real: reenvía las cookies httpOnly de sesión (el `fetch` del
 * servidor de Next NO tiene acceso automático a las cookies del
 * navegador — hay que leerlas de la petición entrante y adjuntarlas a
 * mano) y trata un 401 del backend como la señal de autoridad real de "no
 * hay sesión válida" — el backend es la única fuente de verdad de
 * autenticación, Next nunca duplica ese estado.
 */
export async function serverFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const res = await fetch(`${INTERNAL_API_URL}${path}`, {
    ...init,
    headers: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (res.status === 401) {
    redirect('/login');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? `Error ${res.status}`);
  }

  const text = await res.text();
  if (text === '') return undefined as T;
  return JSON.parse(text);
}
