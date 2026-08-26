'use client';

import { useTransition } from 'react';
import { updateUserRole, toggleUserActive } from './actions';
import type { AdminUser, Role } from '@/lib/types';

export function UserRowActions({ user, roles }: { user: AdminUser; roles: Role[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={user.roles.role_id}
        disabled={pending}
        onChange={(e) => startTransition(() => updateUserRole(user.user_id, Number(e.target.value)))}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        {roles.map((r) => (
          <option key={r.role_id} value={r.role_id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        disabled={pending}
        onClick={() => startTransition(() => toggleUserActive(user.user_id, !user.is_active))}
        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
          user.is_active ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        }`}
      >
        {user.is_active ? 'Desactivar' : 'Reactivar'}
      </button>
    </div>
  );
}
