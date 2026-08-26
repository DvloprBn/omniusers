'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApiRequest } from '@/lib/client-api';

/** Único formulario real accesible con `must_change_password: true` (ver `AllowPendingPasswordChange` en el backend) — sin esto, una cuenta con contraseña temporal no tendría forma de arreglarse a sí misma. */
export function CambiarPasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await clientApiRequest('/auth/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
      router.push('/cuenta');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <input
        type="password"
        required
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        placeholder="Contraseña actual (la temporal)"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        type="password"
        required
        minLength={8}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Contraseña nueva (mínimo 8 caracteres)"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <button disabled={pending} type="submit" className="w-full rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        Cambiar contraseña
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
