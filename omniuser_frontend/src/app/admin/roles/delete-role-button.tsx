'use client';

import { useState, useTransition } from 'react';
import { deleteRole } from './actions';

export function DeleteRoleButton({ roleId }: { roleId: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-block">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await deleteRole(roleId);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo borrar');
            }
          })
        }
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        Borrar
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
