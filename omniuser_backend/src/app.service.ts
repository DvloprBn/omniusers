import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Usado por `AppController.health` — confirma real que el proceso Node responde, sin tocar Postgres/Redis (eso lo verifica el `healthcheck` de cada contenedor por separado en `docker-compose.yml`). */
  health() {
    return { ok: true, service: 'omniuser_backend', time: new Date().toISOString() };
  }
}
