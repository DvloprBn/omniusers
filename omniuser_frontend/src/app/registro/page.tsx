import { RegistroForm } from './registro-form';

export default function RegistroPage() {
  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-bold text-(--brand-dark)">Crear cuenta</h1>
      <RegistroForm />
    </div>
  );
}
