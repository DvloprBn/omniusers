// Siembra real de desarrollo — roles base del sistema + cuentas de prueba,
// una por rol, para poder probar el RBAC real de inmediato (y para que
// `app/dev/cuentas-de-prueba` del frontend, ver PLAN_DESARROLLO.md §1.7,
// tenga con qué trabajar). Nunca se corre en producción (ver
// docker-compose.yml: solo el servicio de desarrollo la encadena al
// arranque).
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Contraseña compartida SOLO por las cuentas de prueba de este seed — nunca
// se usa para una cuenta real. Cambiar en cualquier proyecto que parta de
// este esqueleto (ver README real del proyecto).
const TEST_PASSWORD = 'TestOnly123!';

// is_system:true en los 6 — los 5 de jerarquía porque UsersService razona
// sobre su `level` real (borrar/renombrar cualquiera rompería esa lógica);
// "usuario" porque AuthService.register() busca ese nombre literal para el
// autoregistro público (borrarlo rompería el registro de cuentas nuevas).
//
// Jerarquía real (level, mayor = más autoridad) — quien gestiona cuentas
// solo puede asignar/editar un rol de nivel ESTRICTAMENTE MENOR al suyo
// (ver UsersService.assertCanManageRole). max_count real: Super y Director
// son cargos de una sola persona — el sistema lo hace cumplir de verdad,
// no solo por convención.
const ROLES = [
  { name: 'usuario', description: 'Cuenta pública autoregistrada — sin acceso al panel', is_system: true, level: 0, max_count: null },
  { name: 'staff', description: 'Operación básica del panel', is_system: true, level: 1, max_count: null },
  { name: 'manager', description: 'Gestiona staff de su área', is_system: true, level: 2, max_count: null },
  { name: 'admin', description: 'Administra manager/staff, usuarios y seguridad', is_system: true, level: 3, max_count: null },
  { name: 'director', description: 'Dirección — un solo cargo real', is_system: true, level: 4, max_count: 1 },
  { name: 'super', description: 'Control técnico total del proyecto — un solo cargo real', is_system: true, level: 5, max_count: 1 },
] as const;

const TEST_ACCOUNTS = [
  { email: 'super+omniuser@example.com', role: 'super' },
  { email: 'director+omniuser@example.com', role: 'director' },
  { email: 'admin+omniuser@example.com', role: 'admin' },
  { email: 'manager+omniuser@example.com', role: 'manager' },
  { email: 'staff+omniuser@example.com', role: 'staff' },
  { email: 'usuario+omniuser@example.com', role: 'usuario' },
] as const;

async function main() {
  console.log('Sembrando roles...');
  const roleByName = new Map<string, number>();
  for (const r of ROLES) {
    const role = await prisma.roles.upsert({
      where: { name: r.name },
      update: { description: r.description, is_system: r.is_system, level: r.level, max_count: r.max_count },
      create: r,
    });
    roleByName.set(r.name, role.role_id);
  }

  console.log('Sembrando cuentas de prueba...');
  const testPasswordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  for (const acc of TEST_ACCOUNTS) {
    const existing = await prisma.users.findUnique({ where: { email: acc.email } });
    if (existing) {
      console.log(`  ya existía: ${acc.email}`);
      continue;
    }
    const created = await prisma.users.create({
      data: {
        email: acc.email,
        password_hash: testPasswordHash,
        name: `Cuenta de prueba (${acc.role})`,
        role_id: roleByName.get(acc.role)!,
      },
    });
    console.log(`  creada: ${acc.email} (rol ${acc.role}, password: ${TEST_PASSWORD}, id: ${created.user_id})`);
  }

  console.log('Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
