import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// Prisma 7 (generator "prisma-client"): el cliente vive en generated/prisma,
// no en @prisma/client. El punto de entrada real es "client.ts", no un
// "index.ts" — hay que apuntar al archivo explícito.
import { PrismaClient } from '../../generated/prisma/client';
// Prisma 7: PrismaClient exige un "driver adapter" explícito en el
// constructor. Para Postgres, este paquete habla el protocolo directo vía
// la librería "pg" (node-postgres).
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Envoltura real de PrismaClient como un provider de NestJS — así cualquier
 * servicio puede inyectar `PrismaService` (vía DI) en vez de instanciar su
 * propio cliente. `PrismaModule` la expone global (ver ese archivo), así
 * que no hace falta reimportar este módulo en cada feature.
 *
 * No expone métodos propios: hereda TODO lo que Prisma genera (`this.users`,
 * `this.roles`, `this.$transaction(...)`, etc.) directo de `PrismaClient`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  /** Abre la conexión real a Postgres al arrancar el módulo — nunca se deja para la primera query. */
  async onModuleInit() {
    await this.$connect();
  }

  /** Cierra la conexión de forma ordenada al apagar el proceso (evita conexiones huérfanas en Postgres). */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
