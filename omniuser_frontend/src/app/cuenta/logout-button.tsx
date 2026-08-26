'use client';

import { useRouter } from 'next/navigation';
import { clientApiRequest } from '@/lib/client-api';

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    await clientApiRequest('/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <button onClick={handleLogout} className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100">
      Cerrar sesión
    </button>
  );
}
