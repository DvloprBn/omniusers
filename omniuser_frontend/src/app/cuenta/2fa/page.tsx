import { serverFetch } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/types';
import { TwoFactorPanel } from './two-factor-panel';

export default async function TwoFactorPage() {
  const user = await serverFetch<AuthenticatedUser>('/auth/me');
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-(--brand-dark)">Autenticación de 2 factores</h1>
      <TwoFactorPanel initiallyEnabled={user.totp_enabled} />
    </div>
  );
}
