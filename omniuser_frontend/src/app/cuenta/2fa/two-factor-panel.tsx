'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApiRequest } from '@/lib/client-api';

type SetupState = 'idle' | 'scanning' | 'showing-recovery-codes';

/**
 * Panel real de administración de 2FA de la cuenta propia — 3 flujos
 * reales: activar (genera QR real → confirma con un código real → muestra
 * los 10 códigos de recuperación UNA vez), desactivar, y regenerar códigos
 * de recuperación (ambas piden la contraseña actual, ver
 * `TwoFactorService`).
 */
export function TwoFactorPanel({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setupState, setSetupState] = useState<SetupState>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSetup() {
    setPending(true);
    setError(null);
    try {
      const result = await clientApiRequest<{ qrCodeDataUrl: string; secret: string }>('/two-factor/setup', { method: 'POST' });
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setSecret(result.secret);
      setSetupState('scanning');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el setup');
    } finally {
      setPending(false);
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await clientApiRequest<{ recoveryCodes: string[] }>('/two-factor/confirm-setup', { method: 'POST', body: JSON.stringify({ code }) });
      setRecoveryCodes(result.recoveryCodes);
      setSetupState('showing-recovery-codes');
      setEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setPending(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await clientApiRequest('/two-factor/disable', { method: 'POST', body: JSON.stringify({ currentPassword }) });
      setEnabled(false);
      setCurrentPassword('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desactivar');
    } finally {
      setPending(false);
    }
  }

  if (setupState === 'showing-recovery-codes' && recoveryCodes) {
    return (
      <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Guarda estos 10 códigos de recuperación reales — solo se muestran esta vez.</p>
        <div className="grid grid-cols-2 gap-1 font-mono text-sm">
          {recoveryCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <button onClick={() => setSetupState('idle')} className="rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white">
          Ya los guardé
        </button>
      </div>
    );
  }

  if (setupState === 'scanning' && qrCodeDataUrl) {
    return (
      <form onSubmit={confirmSetup} className="space-y-3">
        <p className="text-sm text-neutral-600">Escanea este código con tu app de 2FA (Google Authenticator, Authy, 1Password...):</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI real generado en el momento, no un asset estático */}
        <img src={qrCodeDataUrl} alt="Código QR real de 2FA" className="h-48 w-48" />
        <p className="text-xs text-neutral-500">
          ¿No puedes escanear? Captura manual: <code className="font-mono">{secret}</code>
        </p>
        <input
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código de 6 dígitos"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button disabled={pending} type="submit" className="rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Confirmar y activar
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  if (enabled) {
    return (
      <form onSubmit={handleDisable} className="space-y-3">
        <p className="text-sm text-emerald-700">2FA está activo en tu cuenta.</p>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Contraseña actual (para desactivar)"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button disabled={pending} type="submit" className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">
          Desactivar 2FA
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">2FA no está activo en tu cuenta.</p>
      <button disabled={pending} onClick={startSetup} className="rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        Activar 2FA
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
