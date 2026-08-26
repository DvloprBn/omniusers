'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApiRequest } from '@/lib/client-api';

type Step = 'email' | 'password' | 'two-factor';

/**
 * Login real en 3 pasos, en pantallas separadas (UX estilo Google) — NUNCA
 * un formulario único. Cada paso llama a su propio endpoint real del
 * backend (`/auth/login/step1`, `/auth/login/step2`, `/auth/login/2fa`) —
 * el estado `step` de este componente es solo UI, la decisión real de "esta
 * cuenta necesita 2FA o no" siempre la toma el backend en `step2`, nunca se
 * adivina aquí.
 */
export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      // Siempre responde éxito (ver AuthService.loginStep1) — nunca revela
      // si el correo existe, solo avanza la UI.
      await clientApiRequest('/auth/login/step1', { method: 'POST', body: JSON.stringify({ email }) });
      setStep('password');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Correo inválido');
    } finally {
      setPending(false);
    }
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await clientApiRequest<{ requiresTwoFactor: boolean; user?: { role: string } }>('/auth/login/step2', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (result.requiresTwoFactor) {
        setStep('two-factor');
      } else {
        router.push(result.user?.role === 'usuario' ? '/' : '/admin');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Credenciales inválidas');
    } finally {
      setPending(false);
    }
  }

  async function handleTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await clientApiRequest<{ user: { role: string } }>('/auth/login/2fa', { method: 'POST', body: JSON.stringify({ code }) });
      router.push(result.user.role === 'usuario' ? '/' : '/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-bold text-(--brand-dark)">Iniciar sesión</h1>

      {step === 'email' && (
        <form onSubmit={handleStep1} className="mt-6 space-y-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button disabled={pending} type="submit" className="w-full rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            Siguiente
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handleStep2} className="mt-6 space-y-3">
          <p className="text-sm text-neutral-600">{email}</p>
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button disabled={pending} type="submit" className="w-full rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            Iniciar sesión
          </button>
        </form>
      )}

      {step === 'two-factor' && (
        <form onSubmit={handleTwoFactor} className="mt-6 space-y-3">
          <p className="text-sm text-neutral-600">Escribe el código de tu app de autenticación (o un código de recuperación).</p>
          <input
            type="text"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button disabled={pending} type="submit" className="w-full rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            Verificar
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
