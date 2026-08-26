import Link from 'next/link';
import { serverFetch } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/types';

/** Mismos 3 roles reales que ya exige el backend en `UsersController`/`RolesController` — mismo criterio que `AdminLayout`, para no mostrar un atajo hacia una página que de todos modos va a rebotar. */
const CAN_MANAGE_USERS_AND_ROLES = ['admin', 'director', 'super'];

export default async function AdminDashboardPage() {
  const user = await serverFetch<AuthenticatedUser>('/auth/me');
  const canManageUsersAndRoles = CAN_MANAGE_USERS_AND_ROLES.includes(user.role);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-(--brand-dark)">Panel de administración</h1>
      {canManageUsersAndRoles ? (
        <div className="flex gap-4">
          <Link href="/admin/usuarios" className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium hover:border-(--brand)">
            Usuarios
          </Link>
          <Link href="/admin/roles" className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium hover:border-(--brand)">
            Roles
          </Link>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">Tu rol (<strong>{user.role}</strong>) no gestiona usuarios ni roles — ve a &quot;Mi cuenta&quot; para tu 2FA.</p>
      )}
    </div>
  );
}
