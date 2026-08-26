import Link from 'next/link';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-(--brand-dark)">Panel de administración</h1>
      <div className="flex gap-4">
        <Link href="/admin/usuarios" className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium hover:border-(--brand)">
          Usuarios
        </Link>
        <Link href="/admin/roles" className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium hover:border-(--brand)">
          Roles
        </Link>
      </div>
    </div>
  );
}
