import { redirect } from 'next/navigation';
import { serverFetch } from '@/lib/api';
import type { AuthenticatedUser, Role } from '@/lib/types';
import { CreateRoleForm } from './create-role-form';
import { DeleteRoleButton } from './delete-role-button';

export default async function AdminRolesPage() {
  const me = await serverFetch<AuthenticatedUser>('/auth/me');
  if (!['admin', 'director', 'super'].includes(me.role)) {
    redirect('/admin');
  }

  const roles = await serverFetch<Role[]>('/roles');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-(--brand-dark)">Roles</h1>
      <CreateRoleForm />
      <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Nivel</th>
              <th className="px-4 py-2">Tope</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Del sistema</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {roles.map((r) => (
              <tr key={r.role_id}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-neutral-600">{r.level}</td>
                <td className="px-4 py-3 text-neutral-600">{r.max_count ?? 'Sin límite'}</td>
                <td className="px-4 py-3 text-neutral-600">{r.description ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-600">{r.is_system ? 'Sí' : 'No'}</td>
                <td className="px-4 py-3">{!r.is_system && <DeleteRoleButton roleId={r.role_id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
