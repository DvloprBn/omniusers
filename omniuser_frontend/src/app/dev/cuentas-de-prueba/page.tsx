import { notFound } from 'next/navigation';
import { TestAccountsPanel } from './test-accounts-panel';

/**
 * Atajo real de desarrollo para saltar entre roles sin cerrar/reabrir
 * sesión a mano en cada prueba — llama al login REAL (`/auth/login/step2`)
 * contra las cuentas reales sembradas por `prisma/seed.ts`, NUNCA un bypass
 * de autenticación. `notFound()` si el proceso corre en producción — esta
 * página no debe existir fuera de desarrollo.
 */
export default function DevTestAccountsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-xl font-bold text-(--brand-dark)">Cuentas de prueba (solo desarrollo)</h1>
      <p className="mt-1 text-sm text-neutral-600">Cada botón llama al login real con una cuenta sembrada por `prisma/seed.ts` — nunca un bypass de autenticación.</p>
      <TestAccountsPanel />
    </div>
  );
}
