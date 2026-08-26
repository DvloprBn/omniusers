import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { SecurityEventsModule } from './security-events/security-events.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MailModule,
    // Límite global por IP, generoso a propósito: solo atrapa abuso grueso
    // del API completo. Endpoints puntuales de alto riesgo (login/registro/
    // 2FA) tienen su propio límite más estricto vía @Throttle() (ver
    // AuthController). Guardado en Redis, no en memoria, para que el
    // conteo sobreviva un restart del backend.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: seconds(60), limit: 60 }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    AuthModule,
    TwoFactorModule,
    RolesModule,
    UsersModule,
    SecurityEventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Aplica ThrottlerGuard a TODO endpoint por default — un @Throttle()
    // puntual en un controller SOBREESCRIBE este límite global para ese
    // endpoint, nunca se suma a él.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
