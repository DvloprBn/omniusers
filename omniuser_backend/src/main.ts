import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // En producción, el reverse proxy (Caddy/nginx) es el único salto delante
  // de este proceso — "trust proxy: 1" le dice a Express que confíe en el
  // X-Forwarded-For de ESE único salto para calcular req.ip real.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Este backend nunca sirve HTML — contentSecurityPolicy:false porque las
  // directivas por defecto de helmet están pensadas para páginas con
  // scripts/estilos inline, no aplican aquí. crossOriginResourcePolicy en
  // 'cross-origin' porque el frontend real vive en otro puerto/origen.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(cookieParser());

  // whitelist+forbidNonWhitelisted: mitigación directa de OWASP API3 (un
  // usuario mandando "role_id: 1" en el body de su propio update) —
  // cualquier campo del body que no esté declarado en el DTO se rechaza.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // credentials:true es obligatorio para que el navegador mande/reciba las
  // cookies httpOnly de auth en requests cross-origin (frontend y backend
  // corren en puertos distintos, aunque sea el mismo "sitio" en dev).
  app.enableCors({
    origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  // Spec OpenAPI expuesto SOLO como JSON crudo en /api-json, sin la UI HTML
  // propia de Nest — la UI real vive en omniuser_docs (mkdocs-swagger-ui-tag,
  // ver PLAN_DESARROLLO.md §9). Apagado por completo en producción: el mapa
  // completo de rutas/DTOs de la API es información de reconocimiento útil
  // para un atacante (OWASP API9).
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('OmniUser — API')
      .setDescription('Sistema de acceso real: login en 3 pasos, 2FA (TOTP), roles dinámicos')
      .setVersion('0.1')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    app.getHttpAdapter().get('/api-json', (_req: Request, res: Response) => res.json(document));
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
