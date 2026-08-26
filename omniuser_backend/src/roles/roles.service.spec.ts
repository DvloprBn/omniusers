import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

/**
 * Prueba de INTEGRACIÓN real — mismo criterio que `users.service.spec.ts`:
 * `PrismaService` real contra el Postgres real de desarrollo, sin mocks de
 * Prisma. Aquí se prueba la otra mitad de la regla de jerarquía: que un
 * rol nuevo/editado nunca pueda terminar con más autoridad (`level`) que
 * quien lo crea, y que un rol `is_system` (los 6 del seed real) nunca
 * pierda su `level`/`max_count` real por esta vía.
 */
describe('RolesService (integración real, Postgres real)', () => {
  let service: RolesService;
  let prisma: PrismaService;
  const testRoleIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesService, PrismaService],
    }).compile();

    service = module.get(RolesService);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    if (testRoleIds.length) {
      await prisma.roles.deleteMany({ where: { role_id: { in: testRoleIds } } });
    }
    await prisma.$disconnect();
  });

  function actorWith(role: string, roleLevel: number): AuthenticatedUser {
    return { userId: 'actor-de-prueba-jest', role, roleLevel, mustChangePassword: false };
  }

  it('un actor admin (nivel 3) NO puede crear un rol de nivel 3 (igual al suyo)', async () => {
    const actor = actorWith('admin', 3);
    const name = `prueba_jest_igual_${Date.now()}`;

    await expect(service.create({ name, level: 3 }, actor)).rejects.toThrow(/mismo nivel o superior/);

    expect(await prisma.roles.findUnique({ where: { name } })).toBeNull();
  });

  it('un actor admin (nivel 3) SÍ puede crear un rol de nivel 1 (estrictamente menor)', async () => {
    const actor = actorWith('admin', 3);
    const name = `prueba_jest_menor_${Date.now()}`;

    const created = await service.create({ name, level: 1 }, actor);
    testRoleIds.push(created.role_id);

    expect(created.level).toBe(1);
    expect(created.is_system).toBe(false);
  });

  it('un rol creado sin level explícito recibe el default real 0 (sin ninguna autoridad)', async () => {
    const actor = actorWith('super', 5);
    const name = `prueba_jest_sinlevel_${Date.now()}`;

    const created = await service.create({ name }, actor);
    testRoleIds.push(created.role_id);

    expect(created.level).toBe(0);
  });

  it('rechaza cambiar el level real de un rol is_system (ej. staff, sembrado real)', async () => {
    const staffReal = await prisma.roles.findUniqueOrThrow({ where: { name: 'staff' } });
    const actor = actorWith('super', 5);

    await expect(service.update(staffReal.role_id, { level: 2 }, actor)).rejects.toThrow(/no se pueden cambiar/);

    // Confirma que el rol real de staff sigue exactamente en su nivel sembrado — nunca se tocó de verdad.
    const sigueIgual = await prisma.roles.findUniqueOrThrow({ where: { role_id: staffReal.role_id } });
    expect(sigueIgual.level).toBe(1);
  });

  it('un actor super (nivel 5) no puede editar un rol de prueba dejándolo en nivel 5 (igual al suyo)', async () => {
    const actorAdmin = actorWith('admin', 3);
    const name = `prueba_jest_editar_${Date.now()}`;
    const created = await service.create({ name, level: 2 }, actorAdmin);
    testRoleIds.push(created.role_id);

    const actorSuper = actorWith('super', 5);
    await expect(service.update(created.role_id, { level: 5 }, actorSuper)).rejects.toThrow(/mismo nivel o superior/);

    const sigueIgual = await prisma.roles.findUniqueOrThrow({ where: { role_id: created.role_id } });
    expect(sigueIgual.level).toBe(2);
  });
});
