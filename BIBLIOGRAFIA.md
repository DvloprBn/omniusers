# Bibliografía y Referencias de Estudio — Omniskeleton (Login)

> No es un listado al final — es la fuente real detrás de cada decisión de arquitectura de este proyecto, para que puedas ir a la fuente primaria en vez de confiar solo en la explicación de segunda mano. Se agrega una entrada nueva cada vez que una decisión real se apoye en algo de aquí — nunca todo de golpe al final.

## Estándares y RFCs (la fuente primaria real, no un tutorial sobre ellos)

- **JWT — RFC 7519**: <https://datatracker.ietf.org/doc/html/rfc7519> — la definición formal del formato que usamos para el access token.
- **TOTP — RFC 6238**: <https://datatracker.ietf.org/doc/html/rfc6238> — el algoritmo real detrás del 2FA que vamos a construir (el mismo que usan Google Authenticator/Authy).
- **OAuth 2.0 — RFC 6749**: <https://datatracker.ietf.org/doc/html/rfc6749> — solo relevante para la Fase 2 (login real con Google), no para el arranque.

## OWASP (seguridad — la referencia real detrás de `PRUEBAS_SEGURIDAD.md`)

- **OWASP API Security Project**: <https://owasp.org/www-project-api-security/> — el Top 10 real que estructura `PRUEBAS_SEGURIDAD.md`.
- **OWASP Cheat Sheet Series**: <https://cheatsheetseries.owasp.org/> — hojas de referencia concretas (autenticación, manejo de sesión, prevención de inyección) — se cita la hoja específica conforme se use en una decisión real, no de antemano.

## Documentación oficial del stack (misma arquitectura que Espiral/Dely Doggy)

- **NestJS — Autenticación**: <https://docs.nestjs.com/security/authentication>
- **NestJS — Rate limiting (Throttler)**: <https://docs.nestjs.com/security/rate-limiting>
- **Prisma**: <https://www.prisma.io/docs>
- **Next.js**: <https://nextjs.org/docs>

## Librerías reales que probablemente usemos (se confirma al diseñar, no antes)

- **`otplib`** (TOTP/HOTP en Node.js, implementa RFC 6238 real): <https://www.npmjs.com/package/otplib>
- **`bcryptjs`** (hash de contraseñas — mismo paquete ya usado en Espiral/Dely Doggy): <https://www.npmjs.com/package/bcryptjs>

## Código real de referencia (los propios proyectos hermanos)

- `projects/espiral/` — roles dinámicos, `RolesGuard`, arquitectura general.
- `projects/delyDoggy/` — misma base de auth (JWT/refresh/rotación), 2 rondas reales de auditoría de seguridad ya corregidas, `DocumentacionProyecto/Bridge/` con las lecciones ya generalizadas.

*(Sin entradas todavía sobre 2FA/TOTP aplicado en código real, ni sobre Google OAuth — se agregan cuando se diseñe esa pieza en concreto.)*
