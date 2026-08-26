'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApiRequest } from '@/lib/client-api';

/** Mismos 6 correos/contraseña reales que siembra `prisma/seed.ts` (`TEST_PASSWORD`) — si cambia ahí, hay que cambiarlo aquí también. */
const TEST_ACCOUNTS = [
  { email: 'super+omniuser@example.com', role: 'super' },
  { email: 'director+omniuser@example.com', role: 'director' },
  { email: 'admin+omniuser@example.com', role: 'admin' },
  { email: 'manager+omniuser@example.com', role: 'manager' },
  { email: 'staff+omniuser@example.com', role: 'staff' },
  { email: 'usuario+omniuser@example.com', role: 'usuario' },
] as const;
const TEST_PASSWORD = 'TestOnly123!';

export function TestAccountsPanel() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginAs(email: string, role: string) {
    setPending(email);
    setError(null);
    try {
      // Login real de 2 pasos — estas cuentas de prueba no tienen 2FA
      // activo, así que step2 ya emite la sesión completa.
      const result = await clientApiRequest<{ requiresTwoFactor: boolean; user?: { role: string } }>('/auth/login/step2', {
        method: 'POST',
        body: JSON.stringify({ email, password: TEST_PASSWORD }),
      });
      if (result.requiresTwoFactor) {
        setError('Esta cuenta de prueba activó 2FA — usa /login normal.');
        return;
      }
      router.push(role === 'usuario' ? '/' : '/admin');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      {TEST_ACCOUNTS.map((acc) => (
        <button
          key={acc.email}
          disabled={pending !== null}
          onClick={() => loginAs(acc.email, acc.role)}
          className="block w-full rounded-md border border-neutral-300 px-4 py-2 text-left text-sm hover:border-(--brand) disabled:opacity-50"
        >
          Entrar como <strong>{acc.role}</strong> <span className="text-neutral-500">({acc.email})</span>
        </button>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
