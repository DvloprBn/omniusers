'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApiRequest } from '@/lib/client-api';

export function RegistroForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await clientApiRequest('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name: name || undefined }) });
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      <input
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña (mínimo 8 caracteres)"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <button disabled={pending} type="submit" className="w-full rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        Crear cuenta
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
