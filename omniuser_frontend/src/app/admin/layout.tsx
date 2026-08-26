import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverFetch } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/types';
import { LogoutButton } from '../cuenta/logout-button';

/** Roles con acceso real a la gestión de Usuarios/Roles — mismos 3 que el backend exige en `UsersController`/`RolesController` (`@Roles('admin','director','super')`). Staff/Manager entran al panel, pero sin estas 2 secciones. */
const CAN_MANAGE_USERS_AND_ROLES = ['admin', 'director', 'super'];

/**
 * Gate real del panel de administración — cualquier rol real de la
 * jerarquía (`staff`/`manager`/`admin`/`director`/`super`), NUNCA
 * `usuario` (el rol público) — verificado en el SERVIDOR (nunca confiar en
 * ocultar un link del lado del cliente como si fuera seguridad real). La
 * autorización REAL de cada acción sigue viviendo en el backend
 * (`RolesGuard` + la regla fina de nivel en `UsersService`/`RolesService`)
 * — esto es solo la capa de UX que evita mostrar un panel roto a quien no
 * debería verlo.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await serverFetch<AuthenticatedUser>('/auth/me');
  if (user.must_change_password) {
    redirect('/cambiar-password');
  }
  if (user.role === 'usuario') {
    redirect('/cuenta');
  }

  const canManageUsersAndRoles = CAN_MANAGE_USERS_AND_ROLES.includes(user.role);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin" className="font-bold text-(--brand-dark)">
            OmniUser — Admin
          </Link>
          {canManageUsersAndRoles && (
            <>
              <Link href="/admin/usuarios" className="text-neutral-600 hover:text-(--brand)">
                Usuarios
              </Link>
              <Link href="/admin/roles" className="text-neutral-600 hover:text-(--brand)">
                Roles
              </Link>
            </>
          )}
          <Link href="/cuenta" className="text-neutral-600 hover:text-(--brand)">
            Mi cuenta
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>
            {user.email} · {user.role}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
