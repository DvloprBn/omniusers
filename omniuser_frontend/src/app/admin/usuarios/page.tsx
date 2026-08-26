import { serverFetch } from '@/lib/api';
import type { AdminUser, Role } from '@/lib/types';
import { CreateUserForm } from './create-user-form';
import { UserRowActions } from './user-row-actions';

export default async function AdminUsuariosPage() {
  const [users, roles] = await Promise.all([serverFetch<AdminUser[]>('/users'), serverFetch<Role[]>('/roles')]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-(--brand-dark)">Usuarios</h1>
      <CreateUserForm roles={roles} />
      <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Correo</th>
              <th className="px-4 py-2">2FA</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-neutral-500">
                  Todavía no hay usuarios.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.user_id}>
                <td className="px-4 py-3 text-neutral-900">{u.name ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-700">{u.email}</td>
                <td className="px-4 py-3 text-neutral-700">{u.totp_enabled ? 'Activo' : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'}`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  {u.must_change_password && <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Pendiente cambiar contraseña</span>}
                </td>
                <td className="px-4 py-3">
                  <UserRowActions user={u} roles={roles} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
