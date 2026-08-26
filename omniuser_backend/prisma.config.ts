// Prisma 7: la URL de conexión y las rutas de schema/migraciones viven aquí,
// ya no en schema.prisma. El .env real del proyecto vive un nivel arriba
// (junto a docker-compose.yml) — "dotenv/config" por sí solo solo busca
// ".env" en el directorio actual, por eso se apunta explícito con path.
import { config } from 'dotenv';
config({ path: '../.env' });

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
