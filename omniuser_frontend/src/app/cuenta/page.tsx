import { serverFetch } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/types';

export default async function CuentaPage() {
  const user = await serverFetch<AuthenticatedUser>('/auth/me');
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold text-(--brand-dark)">Mi cuenta</h1>
      <p className="text-sm text-neutral-700">
        <strong>Correo:</strong> {user.email}
      </p>
      <p className="text-sm text-neutral-700">
        <strong>Nombre:</strong> {user.name ?? '—'}
      </p>
      <p className="text-sm text-neutral-700">
        <strong>Rol:</strong> {user.role}
      </p>
      <p className="text-sm text-neutral-700">
        <strong>2FA:</strong> {user.totp_enabled ? 'Activo' : 'Inactivo'}
      </p>
    </div>
  );
}
