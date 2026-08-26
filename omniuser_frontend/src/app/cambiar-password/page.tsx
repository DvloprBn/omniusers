import { CambiarPasswordForm } from './cambiar-password-form';

export default function CambiarPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-bold text-(--brand-dark)">Cambia tu contraseña temporal</h1>
      <p className="mt-1 text-sm text-neutral-600">Por seguridad, debes elegir una contraseña propia antes de continuar.</p>
      <CambiarPasswordForm />
    </div>
  );
}
