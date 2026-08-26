import Link from 'next/link';

/** Sitio público simulado — sin negocio real detrás (ver `PLAN_DESARROLLO.md` §1), solo lo mínimo para tener "algo" que un `usuario` vería fuera del panel de administración. */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-(--brand-dark)">OmniUser</h1>
      <p className="mt-2 text-neutral-600">Sistema de acceso real — login en 3 pasos (correo → contraseña → 2FA), roles dinámicos, panel de administración.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/login" className="rounded-md bg-(--brand) px-4 py-2 text-sm font-medium text-white">
          Iniciar sesión
        </Link>
        <Link href="/registro" className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium">
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
