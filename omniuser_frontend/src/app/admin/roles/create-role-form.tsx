'use client';

import { useActionState } from 'react';
import { createRole, type RoleFormState } from './actions';

const initialState: RoleFormState = {};

export function CreateRoleForm() {
  const [state, action] = useActionState(createRole, initialState);
  return (
    <form action={action} className="flex gap-2 rounded-md border border-neutral-200 bg-white p-4">
      <input name="name" required placeholder="Nombre del rol (ej. editor)" className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      <input name="description" placeholder="Descripción (opcional)" className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      <button type="submit" className="rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white">
        Crear
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
