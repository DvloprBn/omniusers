import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/** `@Global()`, mismo criterio que `PrismaModule` — cualquier módulo inyecta `RedisService` sin reimportar esto. */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
