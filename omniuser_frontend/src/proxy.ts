import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 renombró "middleware.ts" a "proxy.ts". Chequeo OPTIMISTA: solo
// mira si la cookie existe, no valida el JWT ni el rol — más barato y evita
// pegarle al backend en cada navegación. La autorización REAL ocurre en
// cada llamada de lib/api.ts (serverFetch redirige a /login si el backend
// responde 401).
const ACCESS_COOKIE = 'access_token';

function unverifiedRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const hasSession = accessToken !== undefined;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login' && hasSession) {
    const role = accessToken ? unverifiedRole(accessToken) : null;
    return NextResponse.redirect(new URL(role === 'usuario' ? '/' : '/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
