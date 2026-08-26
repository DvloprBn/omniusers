import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * `@Global()`: una vez importado en `AppModule`, cualquier otro módulo
 * puede inyectar `PrismaService` en su `constructor` sin volver a poner
 * `PrismaModule` en su propio arreglo `imports` — evita repetir el import
 * en los ~10 módulos reales de este proyecto que necesitan hablarle a la
 * base de datos.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
