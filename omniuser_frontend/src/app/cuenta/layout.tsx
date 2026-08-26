import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverFetch } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/types';
import { LogoutButton } from './logout-button';

/** Área de autoservicio real para CUALQUIER rol autenticado (perfil, 2FA propio) — a diferencia de `/admin`, aquí no hay restricción de rol, solo de sesión. */
export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const user = await serverFetch<AuthenticatedUser>('/auth/me');
  if (user.must_change_password) {
    redirect('/cambiar-password');
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-bold text-(--brand-dark)">
            OmniUser
          </Link>
          <Link href="/cuenta" className="text-neutral-600 hover:text-(--brand)">
            Mi cuenta
          </Link>
          <Link href="/cuenta/2fa" className="text-neutral-600 hover:text-(--brand)">
            2FA
          </Link>
          {(user.role === 'admin' || user.role === 'super') && (
            <Link href="/admin" className="text-neutral-600 hover:text-(--brand)">
              Panel de administración
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>
            {user.email} · {user.role}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-8">{children}</main>
    </div>
  );
}
