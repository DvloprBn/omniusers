# OmniUser

Este portal es la **referencia técnica** del proyecto — crece junto con el código (rutas de la API, DTOs, módulos). Se genera solo a partir de lo que ya existe en el backend, no reemplaza a la documentación de estrategia.

Para la estrategia, el roadmap, el modelo de datos y las decisiones de arquitectura, la fuente sigue siendo la raíz del repositorio:

- `PLAN_DESARROLLO.md` — estrategia, alcance, decisiones.
- `ESTADO_PROYECTO.md` — estado día a día, con el historial completo de cada cambio.
- `DOCUMENTO_VIVO_ARQUITECTURA.md` — el detalle técnico y el porqué de cada pieza.
- `APRENDIZAJE.md` — explicaciones técnicas reales, con el código de este proyecto como ejemplo.
- `PRUEBAS_SEGURIDAD.md` — pruebas de seguridad reales, replicables paso a paso.
- `BIBLIOGRAFIA.md` — las fuentes reales (RFCs, OWASP, docs oficiales) detrás de cada decisión.
- `omniuser_backend/prisma/schema.prisma` — modelo de datos, con comentarios TSDoc explicando el porqué de cada campo no obvio.

## Qué encontrarás aquí

- **[Jerarquía de roles](roles.md):** cómo funciona de verdad el sistema de niveles y `max_count`.
- **[API (OpenAPI)](api.md):** referencia interactiva de cada endpoint, generada en vivo desde el código del backend vía `@nestjs/swagger` — se actualiza sola.
- **Documentación autogenerada del backend completo** (módulos, servicios, grafo de dependencias) vía Compodoc, en `http://localhost:8097`.

## Módulos del backend

| Módulo | Qué cubre |
|---|---|
| `auth` | Registro, login en 3 pasos, refresh/logout, cambio y recuperación de contraseña |
| `two-factor` | 2FA real (TOTP): setup, confirmación, desactivar, códigos de recuperación |
| `roles` | CRUD del catálogo de roles dinámicos, con jerarquía real (`level`/`max_count`) |
| `users` | Administración de cuentas — alta, cambio de rol, activar/desactivar |
| `security-events` | Detección real de fuerza bruta (login y 2FA) |
| `prisma` / `redis` / `mail` | Infraestructura — conexión a Postgres/Redis, envío real de correo (Resend) |

## Mantener esto al día

Este portal (MkDocs + Swagger UI + Compodoc) corre siempre en Docker (`omniuser_docs` puerto 8096, `omniuser_compodoc` puerto 8097) — no requiere ningún paso manual para regenerarse. Lo único que puede quedar desactualizado es **este archivo** (`index.md`): cuando se agregue un módulo nuevo, conviene sumarlo a la tabla de arriba.
