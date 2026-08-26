'use client';

import { useActionState } from 'react';
import { createUser, type UserFormState } from './actions';
import type { Role } from '@/lib/types';

const initialState: UserFormState = {};

export function CreateUserForm({ roles }: { roles: Role[] }) {
  const [state, action] = useActionState(createUser, initialState);
  return (
    <form action={action} className="grid gap-2 rounded-md border border-neutral-200 bg-white p-4 sm:grid-cols-[2fr_2fr_1fr_auto]">
      <input name="email" type="email" required placeholder="Correo" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      <input name="name" placeholder="Nombre (opcional)" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      <select name="role_id" required defaultValue="" className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
        <option value="" disabled>
          Rol
        </option>
        {roles.map((r) => (
          <option key={r.role_id} value={r.role_id}>
            {r.name}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white">
        Crear
      </button>
      {state.error && <p className="col-span-full text-sm text-red-600">{state.error}</p>}
      {state.tempPassword && (
        <div className="col-span-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p>La cuenta se creó, pero el correo de bienvenida no se pudo enviar. Comparte esta contraseña temporal a mano:</p>
          <p className="mt-1 font-mono text-base font-bold">{state.tempPassword}</p>
        </div>
      )}
    </form>
  );
}
