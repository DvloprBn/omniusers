import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Cliente real de Redis, envuelto como provider de NestJS (extiende la
 * clase `Redis` de `ioredis` directo — cualquier método real de `ioredis`
 * ya está disponible en `this`, ej. `this.incr(...)`, `this.expire(...)`).
 *
 * Usado por 2 cosas reales en este proyecto: el `ThrottlerModule` (límite
 * de peticiones global, guardado en Redis para sobrevivir un restart del
 * backend) y `SecurityEventsService` (conteo de intentos fallidos con
 * ventana deslizante — login y 2FA).
 */
@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // "omniuser_redis" (no "localhost") — el backend le habla a Redis por
    // la red interna de docker-compose, con el nombre del servicio, no por
    // el puerto expuesto al host (ese solo existe para conectarse desde
    // fuera de Docker con redis-cli).
    super({
      host: 'omniuser_redis',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: false,
    });
  }

  /** Confirma la conexión real al arrancar (falla rápido y visible si Redis no responde, en vez de fallar silencioso en el primer uso real). */
  async onModuleInit() {
    await this.ping();
  }

  /** Cierra la conexión de forma ordenada al apagar el proceso. */
  async onModuleDestroy() {
    await this.quit();
  }
}
