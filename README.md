# OmniUser

Sistema de acceso real y completo — login en 3 pasos (estilo Google), 2FA real (TOTP), y una jerarquía real de roles con niveles de autoridad. Construido como proyecto de estudio propio (sin negocio real detrás), pero con el mismo estándar de producción de mis otros proyectos: sin atajos simulados, con pruebas de seguridad reales, y documentado al grado de poder leerse y entenderse completo.

## Qué tiene de verdad

- **Login en 3 pasos, en pantallas separadas** (correo → contraseña → 2FA si aplica) — nunca un formulario único.
- **2FA real** (RFC 6238/TOTP): QR real, secreto cifrado en reposo (AES-256-GCM), 10 códigos de recuperación de un solo uso.
- **Roles dinámicos y jerárquicos**: catálogo de roles editable en caliente, con nivel de autoridad real — nadie puede crear ni gestionar una cuenta o un rol de su mismo nivel o superior. `super` y `director` son cargos de una sola persona, aplicado de verdad (no solo por convención).
- **Sesiones reales**: JWT en cookie httpOnly + refresh token con rotación y ventana de gracia; revocación en cascada si se detecta reuso de un token robado.
- **Seguridad real desde el día uno**: rate limiting dedicado, detección de fuerza bruta (login y 2FA), `ValidationPipe` con whitelist estricta, cabeceras de seguridad, CORS explícito.
- **Panel de administración real**: gestión de usuarios y roles, respetando la jerarquía en cada acción.

## Stack

NestJS 11 + Prisma 7 + PostgreSQL 18 (backend) · Next.js 16 + React 19 (frontend) · Redis (rate limiting) · Docker Compose.

## Arrancar en local

```bash
cp .env.example .env   # rellena los secretos reales (ver comentarios del archivo)
docker compose up -d
```

- Frontend: http://localhost:3031
- Backend: http://localhost:3030
- Cuentas de prueba (sembradas automáticamente, password `TestOnly123!`): `super+omniuser@example.com`, `director+omniuser@example.com`, `admin+omniuser@example.com`, `manager+omniuser@example.com`, `staff+omniuser@example.com`, `usuario+omniuser@example.com`.
- En desarrollo, `/dev/cuentas-de-prueba` deja saltar entre roles con un login real (nunca un bypass).

## Pruebas

25 tests reales (`jest`), sin mocks de Prisma — 3 sobre funciones puras (TOTP, cifrado AES-256-GCM, escape HTML) y 2 de integración contra el Postgres real de desarrollo, probando la jerarquía de roles.

```bash
docker compose exec omniuser_backend npm test
```

## Documentación

Este proyecto se documenta igual que se construye — sin atajos:

- [`PLAN_DESARROLLO.md`](./PLAN_DESARROLLO.md) — estrategia y decisiones reales.
- [`DOCUMENTO_VIVO_ARQUITECTURA.md`](./DOCUMENTO_VIVO_ARQUITECTURA.md) — el detalle técnico y el porqué de cada pieza.
- [`PRUEBAS_SEGURIDAD.md`](./PRUEBAS_SEGURIDAD.md) — pruebas de seguridad reales, replicables paso a paso.
- [`BIBLIOGRAFIA.md`](./BIBLIOGRAFIA.md) — las fuentes reales (RFCs, OWASP, docs oficiales) detrás de cada decisión.
- Cada función real del backend lleva su propio comentario de documentación (TSDoc) — qué hace, qué espera, qué regresa.

## Por qué existe

Es un proyecto de estudio explícito — la meta es poder leer y entender todo el código sin ayuda externa — que a la vez está diseñado desde el día uno para ser un módulo reutilizable en un proyecto real futuro.
