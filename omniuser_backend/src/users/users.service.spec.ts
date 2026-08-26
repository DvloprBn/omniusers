import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

/**
 * Prueba de INTEGRACIÓN real — usa `PrismaService` real contra el
 * Postgres real de desarrollo (nunca un mock de Prisma: la regla que se
 * prueba aquí, `assertCanManageRole`, es exactamente la que ya se verificó
 * a mano en `PRUEBAS_SEGURIDAD.md` API1/API5 — esto la deja repetible sin
 * depender de `curl`). Solo `MailService` se sustituye por un stub, porque
 * no tiene sentido depender de una llamada real a Resend en cada corrida
 * de pruebas — el correo en sí ya tiene su propio flujo verificado real
 * por separado.
 */
describe('UsersService (integración real, Postgres real)', () => {
  let service: UsersService;
  let prisma: PrismaService;
  const testEmails: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, PrismaService, { provide: MailService, useValue: { send: jest.fn().mockResolvedValue(true) } }],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    if (testEmails.length) {
      await prisma.refresh_tokens.deleteMany({ where: { users: { email: { in: testEmails } } } });
      await prisma.users.deleteMany({ where: { email: { in: testEmails } } });
    }
    await prisma.$disconnect();
  });

  async function roleIdByName(name: string): Promise<number> {
    return (await prisma.roles.findUniqueOrThrow({ where: { name } })).role_id;
  }

  function actorWith(role: string, roleLevel: number): AuthenticatedUser {
    return { userId: 'actor-de-prueba-jest', role, roleLevel, mustChangePassword: false };
  }

  it('un actor admin (nivel 3) NO puede crear una cuenta con rol director (nivel 4, igual/superior)', async () => {
    const directorRoleId = await roleIdByName('director');
    const email = `prueba.jest.director.${Date.now()}@example.com`;
    const actor = actorWith('admin', 3);

    await expect(service.create({ email, role_id: directorRoleId }, actor)).rejects.toThrow(/mismo nivel o superior/);

    // Confirma que de verdad no se creó nada — nunca confiar solo en el error lanzado.
    const existe = await prisma.users.findUnique({ where: { email } });
    expect(existe).toBeNull();
  });

  it('un actor admin (nivel 3) SÍ puede crear una cuenta con rol manager (nivel 2, estrictamente menor)', async () => {
    const managerRoleId = await roleIdByName('manager');
    const email = `prueba.jest.manager.${Date.now()}@example.com`;
    testEmails.push(email);
    const actor = actorWith('admin', 3);

    const created = await service.create({ email, role_id: managerRoleId }, actor);
    expect(created.email).toBe(email);
  });

  it('respeta el max_count real: rechaza un segundo Director si ya hay 1 cuenta activa con ese rol', async () => {
    const directorRoleId = await roleIdByName('director');
    const actor = actorWith('super', 5);
    const activosAntes = await prisma.users.count({ where: { role_id: directorRoleId, is_active: true } });
    const email = `prueba.jest.director2.${Date.now()}@example.com`;

    if (activosAntes >= 1) {
      await expect(service.create({ email, role_id: directorRoleId }, actor)).rejects.toThrow(/cargo de máximo/);
      expect(await prisma.users.findUnique({ where: { email } })).toBeNull();
    } else {
      // Estado real inusual (sin Director sembrado todavía) — confirma que sí se puede crear el primero.
      testEmails.push(email);
      const created = await service.create({ email, role_id: directorRoleId }, actor);
      expect(created.email).toBe(email);
    }
  });

  it('bloquea gestionar (aunque sea solo desactivar) una cuenta real de nivel igual/superior al del actor', async () => {
    const superReal = await prisma.users.findFirstOrThrow({ where: { roles: { name: 'super' } } });
    const actor = actorWith('admin', 3);

    await expect(service.update(superReal.user_id, { is_active: false }, actor)).rejects.toThrow(/mismo nivel o superior/);

    // Confirma que la cuenta real de super sigue exactamente igual — nunca se tocó de verdad.
    const sigueIgual = await prisma.users.findUniqueOrThrow({ where: { user_id: superReal.user_id } });
    expect(sigueIgual.is_active).toBe(true);
  });
});
