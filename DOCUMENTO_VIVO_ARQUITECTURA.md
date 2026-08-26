# Documento Vivo de Arquitectura — OmniUser (Login)

> Detalle técnico real de cada decisión de arquitectura conforme se toma — el "por qué" detrás de lo que dice `ESTADO_PROYECTO.md`.

## 1. Diseño técnico inicial — schema, módulos, endpoints, monorepo (2026-08-26)

Diseño completo antes de escribir código real, per la regla ya establecida en `CLAUDE.md` (modo diseño hasta confirmación explícita). Todo lo de abajo reutiliza el patrón exacto ya probado y auditado 2 veces (Espiral → Dely Doggy) salvo donde se marca explícito como nuevo.

### 1.1 Estructura del monorepo

Mismo patrón real de los 2 hermanos — 2 apps + infraestructura, un solo `docker-compose.yml` en la raíz:

```
dvlopmnt/login/
├── omniuser_backend/     # NestJS + Prisma
├── omniuser_frontend/    # Next.js
├── docs/                     # Portal MkDocs (ver PLAN_DESARROLLO.md §9)
├── docker-compose.yml
└── (la documentación ya creada: CLAUDE.md, PLAN_DESARROLLO.md, etc.)
```

### 1.2 Puertos — siguiente libre en la secuencia real ya usada en este host

Inari usa 3000/3001/5433; Espiral usa 3010/3011/5434/6379/8092/8093; Dely Doggy usa 3020/3021/5435/6380/5520/8094/8095. OmniUser sigue la secuencia:

| Servicio | Puerto host | Nota |
|---|---|---|
| `omniuser_backend` (API) | 3030 | |
| `omniuser_frontend` | 3031 | |
| `omniuser_db` (Postgres) | 5436 | `127.0.0.1` únicamente |
| `omniuser_redis` | 6381 | `127.0.0.1` únicamente — rate limiting |
| Prisma Studio | 5521 | `127.0.0.1` únicamente |
| `omniuser_docs` (MkDocs) | 8096 | `127.0.0.1` únicamente |
| `omniuser_compodoc` | 8097 | `127.0.0.1` únicamente |

### 1.3 Schema real (Prisma) — primera versión

```prisma
// Roles dinámicos — nunca un enum fijo de Postgres (mismo criterio real
// de Espiral). is_system marca admin/super (o los que se sembren) para
// que nunca se puedan borrar por accidente y dejar el sistema sin un rol
// con acceso administrativo.
model roles {
  role_id     Int      @id @default(autoincrement())
  name        String   @unique @db.VarChar(50)
  description String?  @db.VarChar(200)
  is_system   Boolean  @default(false)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  users       users[]
}

model users {
  user_id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email                String    @unique @db.VarChar(255)
  password_hash        String
  name                 String?   @db.VarChar(150)
  role_id              Int
  must_change_password Boolean   @default(false)
  is_active            Boolean   @default(true)
  // 2FA — null/false hasta que el usuario complete el setup real (ver
  // flujo en 1.4). El secreto se guarda cifrado en reposo (AES, con una
  // llave propia en variable de entorno — NUNCA el mismo JWT_SECRET),
  // nunca en texto plano — a diferencia de password_hash (que es un HASH
  // de una vía), el secreto TOTP es SIMÉTRICO: el servidor necesita poder
  // leerlo de vuelta para verificar el código de la app del usuario, así
  // que "hashear" no aplica aquí, hace falta cifrar.
  totp_secret_encrypted String?
  totp_enabled          Boolean  @default(false)
  created_at             DateTime @default(now()) @db.Timestamptz(6)
  updated_at             DateTime @default(now()) @updatedAt @db.Timestamptz(6)

  roles                  roles                  @relation(fields: [role_id], references: [role_id], onDelete: Restrict)
  refresh_tokens         refresh_tokens[]
  totp_recovery_codes    totp_recovery_codes[]
  password_reset_tokens  password_reset_tokens[]
}

// Mismo patrón real de rotación con ventana de gracia ya probado 2 veces.
model refresh_tokens {
  token_id   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String    @db.Uuid
  token_hash String    @unique
  revoked    Boolean   @default(false)
  used_at    DateTime? @db.Timestamptz(6)
  ip_address String?   @db.VarChar(45)
  user_agent String?
  created_at DateTime  @default(now()) @db.Timestamptz(6)
  expires_at DateTime  @db.Timestamptz(6)
  users      users     @relation(fields: [user_id], references: [user_id], onDelete: Cascade)
}

// Códigos de un solo uso reales para cuando el usuario pierde el
// dispositivo con la app de 2FA — se generan 10 al activar 2FA, se
// muestran UNA vez, se guardan hasheados (bcrypt, igual que una
// contraseña — nunca en texto plano, a diferencia de totp_secret_encrypted
// que sí se puede descifrar: un código de recuperación nunca necesita
// volver a mostrarse, solo compararse).
model totp_recovery_codes {
  code_id    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String    @db.Uuid
  code_hash  String
  used_at    DateTime? @db.Timestamptz(6)
  created_at DateTime  @default(now()) @db.Timestamptz(6)
  users      users     @relation(fields: [user_id], references: [user_id], onDelete: Cascade)
}

// Mismo patrón real ya probado — token de un solo uso, corta vigencia.
model password_reset_tokens {
  token_id   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String    @db.Uuid
  token_hash String    @unique
  used_at    DateTime? @db.Timestamptz(6)
  created_at DateTime  @default(now()) @db.Timestamptz(6)
  expires_at DateTime  @db.Timestamptz(6)
  users      users     @relation(fields: [user_id], references: [user_id], onDelete: Cascade)
}

// Mismo patrón real de Dely Doggy — fuerza bruta en login (y aquí también
// en el paso de 2FA, que es un segundo punto real de fuerza bruta que los
// proyectos hermanos no tenían) con ventana deslizante en Redis.
model security_events {
  security_event_id String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  fingerprint        String    @unique @db.VarChar(64)
  type               String    @db.VarChar(30) // login_bruteforce | twofactor_bruteforce | refresh_token_reuse
  identifier         String
  ip_address         String?   @db.VarChar(45)
  user_agent         String?
  attempts           Int
  occurrence_count   Int       @default(1)
  status             String    @default("nuevo") @db.VarChar(20)
  first_seen_at      DateTime  @default(now()) @db.Timestamptz(6)
  last_seen_at       DateTime  @default(now()) @db.Timestamptz(6)
  resolved_at        DateTime? @db.Timestamptz(6)
  resolved_note      String?
}
```

**Nota real sobre `twofactor_bruteforce`**: Espiral reservó este nombre de tipo desde el principio pero nunca construyó el mecanismo real detrás (no tiene 2FA) — aquí sí se implementa completo, es la primera vez que ese nombre corresponde a algo real.

### 1.4 Flujo real de login con 2FA (Fase 1 — UX de Google, sin OAuth todavía)

1. `POST /auth/login/step1` — recibe `email`. Responde solo si el correo existe o no de forma indistinguible en tiempo/mensaje (mismo criterio anti-enumeración de cuentas que ya usan los hermanos en forgot-password) — el frontend avanza a la pantalla de contraseña sin importar la respuesta real.
2. `POST /auth/login/step2` — recibe `email`+`password`. Si las credenciales son válidas Y `totp_enabled=false` → responde con los tokens reales de una vez (JWT+refresh en cookies httpOnly), login completo. Si son válidas Y `totp_enabled=true` → responde con un **challenge token** de corta vida (ej. 5 min, firmado, propósito único: "este correo ya pasó el paso de contraseña, falta 2FA") — NUNCA emite el JWT de sesión real todavía.
3. `POST /auth/login/2fa` — recibe el `challenge token` + el código TOTP de 6 dígitos. Válido → emite los tokens reales de sesión. Cuenta real de intentos fallidos en Redis (ventana deslizante, mismo mecanismo que el brute-force de login) — un código de recuperación (`totp_recovery_codes`) también se acepta aquí como alternativa real al código TOTP.

### 1.5 Módulos reales del backend (NestJS)

| Módulo | Responsabilidad real |
|---|---|
| `auth` | login (los 3 pasos de 1.4), registro, refresh, logout, cambio/recuperación de contraseña |
| `two-factor` | setup (genera secreto+QR real), confirmar-setup (primer código real, activa 2FA, entrega los 10 códigos de recuperación UNA vez), desactivar, regenerar códigos |
| `roles` | CRUD de roles dinámicos — solo `admin`/`super`, nunca se puede borrar un rol `is_system` ni uno con usuarios activos |
| `users` | administración de cuentas — listar/crear/cambiar rol/activar-desactivar, solo `admin`/`super` |
| `security-events` | mismo patrón real de Dely Doggy — conteo en Redis, fila real solo al cruzar el umbral, alerta por correo |
| `prisma` / `redis` / `mail` | infraestructura — mismo patrón exacto de los 2 hermanos |

### 1.6 Endpoints reales (primera versión)

```
POST   /auth/register
POST   /auth/login/step1
POST   /auth/login/step2
POST   /auth/login/2fa
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
PATCH  /auth/me/password
POST   /auth/forgot-password
POST   /auth/reset-password

POST   /two-factor/setup             (requiere sesión ya iniciada)
POST   /two-factor/confirm-setup
POST   /two-factor/disable
POST   /two-factor/recovery-codes/regenerate

GET    /roles            (admin/super)
POST   /roles            (admin/super)
PATCH  /roles/:id        (admin/super)
DELETE /roles/:id        (admin/super — 409 si is_system o tiene usuarios)

GET    /users            (admin/super)
PATCH  /users/:id        (admin/super — rol, is_active)
```

### 1.7 Frontend real (Next.js)

- `app/(public)/` — landing + 1-2 páginas de ejemplo, sin negocio real.
- `app/login/` — 3 pantallas reales en pasos separados (correo → contraseña → 2FA si aplica), nunca un formulario único — es la pieza real que reproduce la UX de Google pedida.
- `app/registro/`
- `app/admin/` — panel simulado: dashboard + gestión de usuarios + gestión de roles, nav condicionado por rol (mismo patrón real `RolesGuard`/nav de los hermanos).
- `app/admin/2fa/` — pantalla real para activar 2FA (QR real con `qrcode`, o librería equivalente) y ver/regenerar códigos de recuperación.
- `app/dev/cuentas-de-prueba/` — **solo si `NODE_ENV !== 'production'`** — lista de cuentas de prueba reales (una por rol, sembradas) con un botón "Entrar como esta cuenta" que llama al login REAL (nunca un bypass de autenticación) — para poder saltar entre roles sin cerrar/reabrir sesión a mano en cada prueba.

### 1.8 Pendiente de decidir antes de sembrar datos reales

Nombres reales de los roles de ejemplo (`visitante`/`editor`/`moderador`/`admin`/`super`, u otros) — se define al escribir el seed real, no antes (evita inventar un negocio ficticio solo para nombrar roles).

---

## 2. Etapa 1 construida y verificada real de punta a punta (2026-08-26)

Todo el diseño de §1 construido tal cual — `omniuser_backend` (NestJS 11 + Prisma 7 + Postgres 18) y `omniuser_frontend` (Next.js 16.3.1) corriendo real en Docker Compose, mismo stack/versiones exactas que Espiral/Dely Doggy. Estándar de comentarios real aplicado desde el primer archivo (TSDoc en cada función/clase no trivial — ver `PLAN_DESARROLLO.md` §7).

**3 hallazgos reales de infraestructura, encontrados y corregidos al arrancar por primera vez (no en el diseño, en la ejecución real)**:
1. `prisma migrate deploy` solo APLICA migraciones que ya existen — nunca las crea. El schema se había escrito pero nunca se había corrido `prisma migrate dev` una vez para generar la migración real inicial; corregido corriendo `docker compose run --rm omniuser_backend npx prisma migrate dev --name init` a mano una sola vez (crea `prisma/migrations/20260826173838_init/`), después de lo cual el comando normal de arranque (`migrate deploy && db seed && start:dev`) ya funciona solo en cada `docker compose up`.
2. El cliente real de Prisma (`generated/prisma/`, generator personalizado `prisma-client`) tampoco se había generado nunca — mismo motivo, corregido con `prisma generate` explícito la primera vez.
3. `docker-compose.yml` traía una línea real `- /app/.next` (volumen anónimo) copiada por error de un patrón que Dely Doggy no usa — Docker crea un volumen anónimo nuevo con dueño `root`, y el usuario `node` (sin privilegios, por diseño — ver `Dockerfile.dev`) no podía escribir ahí (`EACCES: permission denied, mkdir '/app/.next/dev'`). Corregido quitando esa línea (mismo patrón real de Dely Doggy: solo `node_modules` necesita un volumen aparte, `.next` no) y borrando el directorio `.next` real que había quedado con dueño `root` en el host.

**Aviso de seguridad, ya documentado como patrón recurrente en los proyectos hermanos**: la salida de `npx prisma migrate dev`/`generate` durante este arranque volvió a incluir líneas "tip:" con dominios ajenos al proyecto (`www.dotenvx.com`, `www.vestauth.com` — este último es el MISMO dominio ya visto en sesiones de Dely Doggy) — nunca se actuó sobre ellas, cada resultado se verificó de forma independiente (Postgres directo, curl, capturas de pantalla reales).

**Verificado real de punta a punta, con `curl`/Postgres/Playwright — nunca solo "arrancó"**:
- Registro, login de 2 pasos (cuenta sin 2FA) → sesión real emitida, confirmada con `GET /auth/me`.
- `POST /auth/refresh` real rota el refresh token; `POST /auth/logout` real revoca la sesión — `GET /auth/me` tras logout da 401 real.
- RBAC real: cuenta `usuario` recibe 403 real en `GET /users` (solo `admin`/`super`).
- Rate limiting real: el límite de `login/step2` (5/60s) se agotó de verdad solo con las pruebas normales de esta sesión — confirmado con 429 reales, sin necesidad de un script aparte para probarlo.
- **2FA real, de punta a punta**: `POST /two-factor/setup` → secreto y QR reales; código TOTP real generado con la MISMA librería (`otplib`, corrido dentro del contenedor real, nunca inventado a mano) → `POST /two-factor/confirm-setup` → 10 códigos de recuperación reales entregados; login completo con el código TOTP real; login completo alternativo con UN código de recuperación real (confirmado que el mismo código, reusado, da 401 — un solo uso real); confirmado que el `challenge token` del paso 2 NO sirve para `GET /auth/me` (401 real) — nunca es una sesión real hasta terminar el paso 3.
- Roles dinámicos reales: rol `editor` creado en caliente sin ningún deploy, usuario real asignado a él, intento de borrar el rol `admin` (`is_system`) → 400 real; intento de borrar `editor` con 1 usuario real asignado → 400 real con el conteo correcto. Ambos (usuario y rol de prueba) borrados después.
- Alta administrativa real de usuario: `welcome_email_sent:false` + `temp_password` real devuelto en la respuesta — confirma que `MailService.send()` se degrada de forma correcta (nunca truena el flujo) cuando `RESEND_API_KEY` es un placeholder real, tal como se documentó en `.env.example`.
- Playwright real (Chromium, no simulado): login completo de 2 pasos con captura de pantalla real en cada paso, panel de administración con nav condicionado por rol, tabla real de Usuarios/Roles, activación real de 2FA con el QR real renderizado en pantalla, y confirmación real de que `/admin` redirige a `/login` tras cerrar sesión.
- Estado final de las 3 cuentas sembradas reseteado a limpio (2FA desactivado en las 3) después de las pruebas, para que el dueño explore el flujo de activación él mismo desde cero, no uno ya configurado por la verificación.

`tsc`/compilación limpia en ambos lados (`Found 0 errors` real del watcher de Nest; sin overlay de error real en Next.js — el único stack trace que aparece en los logs de desarrollo es el mecanismo interno normal de Next.js para `redirect()`, no un error real de la aplicación).

## 3. Jerarquía real de roles — Super/Director (1) → Admin/Manager/Staff (varios) → Usuario público (2026-08-26)

Pedido explícito del dueño, con correos reales de ejemplo (`dvloprbn@gmail.com` → `director+dvloprbn@gmail.com` → …) — implementado con placeholders `@example.com` en el seed público (ver §4 más abajo, decisión real sobre correos reales vs. repo público).

**Schema**: `roles` gana `level` (Int, 0=`usuario` … 5=`super`) y `max_count` (Int?, `null`=sin límite). Sembrado real: `usuario`=0, `staff`=1, `manager`=2, `admin`=3, `director`=4 (`max_count:1`), `super`=5 (`max_count:1`) — los 6 marcados `is_system:true` (protegidos de borrado; `director`/`super` además de renombrado/cambio de nivel).

**Regla real de gestión** (`UsersService.assertCanManageRole`, corre en `create`/`update`): quien actúa (`actor.roleLevel`, leído en vivo en `JwtStrategy.validate` — igual que `role`/`mustChangePassword`, nunca del payload firmado) solo puede asignar o editar una cuenta de nivel **estrictamente menor** al suyo. Un Admin puede dar de alta Manager/Staff, nunca otro Admin ni Director/Super — ni siquiera para desactivarlo. Mismo candado real, en espejo, en `RolesService.create`/`update`: nadie puede crear o dejar un rol (propio o de catálogo) en un nivel igual/mayor al suyo — cerraría una escalada real de privilegios (un Admin creando un rol nivel 10 sería, en los hechos, crearse un jefe imaginario con más autoridad que su propio jefe real).

**`max_count` real**: se cuenta contra cuentas ACTIVAS únicamente (`is_active:true`) — desactivar al Director real libera el cupo para nombrar uno nuevo, sin necesidad de "borrar" al anterior (preserva el historial real, mismo criterio que el resto del proyecto). Al reasignar el rol de una cuenta YA EXISTENTE, esa cuenta se excluye de su propio conteo (`excludeUserId`) — reconfirmarle "director" al Director real no debe rechazarse por "ya hay 1".

**Puertas gruesas ampliadas**: `UsersController`/`RolesController` pasan de `@Roles('admin','super')` a `@Roles('admin','director','super')` — la regla FINA de "a quién" vive en el service, no en el guard (mismo patrón real ya usado en Dely Doggy para `local-deliveries`: guard grueso + candado fino de service).

**Frontend**: `/admin` ahora acepta cualquier rol real de la jerarquía (`staff`→`super`), nunca `usuario` — pero "Usuarios"/"Roles" (nav Y accesos rápidos del dashboard) solo se muestran a `admin`/`director`/`super`; `admin/usuarios` y `admin/roles` redirigen de vuelta a `/admin` si alguien fuerza la URL directa (el backend ya lo rechaza real con 403, esto solo evita un error crudo sin manejar). **Hallazgo real durante la verificación con Playwright**: el dashboard (`admin/page.tsx`) tenía sus 2 atajos "Usuarios"/"Roles" SIN ningún candado de rol — el nav sí los ocultaba bien, el dashboard no. No era un hueco de seguridad real (el backend y las sub-páginas ya rechazaban el acceso), pero sí una inconsistencia real de UX — corregido con el mismo candado de rol que ya usa el nav.

**Verificado real, con `curl`**: Admin (nivel 3) intentando crear un Director (nivel 4) → 403 real; Admin creando un Manager (nivel 2, sí permitido) → 201 real; Super intentando crear un SEGUNDO Director (ya había 1 sembrado, `max_count:1`) → 409 real con el conteo correcto; Super intentando crear un rol nuevo de nivel 5 (igual al suyo) → 403 real. Playwright real confirmó visualmente: Director ve Usuarios/Roles en el nav y el dashboard; Manager y Staff no ven ninguno de los dos, en ningún lado de la UI. Todo dato de prueba borrado después.

## 4. Correos reales vs. repo público — decisión real (2026-08-26)

El dueño pidió usar su correo real (`dvloprbn@gmail.com` y variantes `rol+dvloprbn@gmail.com`) para las pruebas reales de esta jerarquía — pero confirmó que el repo real de este proyecto va a ser público (ver conversación: sirve de portafolio real, y la seguridad real de OmniUser nunca depende de que el código sea secreto). Poner un correo real en un archivo commiteado a un repo público lo deja visible para siempre (incluido el historial de git, aunque se borre después) — un blanco real de scraping/spam.

**Resuelto sin tocar `seed.ts`**: el seed real se queda con los placeholders `@example.com` (código real, seguro de mostrar en el repo). Para probar con el correo real del dueño, se usa el flujo YA CONSTRUIDO — `POST /users` (alta administrativa real, `/admin/usuarios`) o `POST /auth/register` (registro público) — nunca hace falta que el correo real toque ningún archivo versionado.

## 5. Documentación automatizada real — `docs/` + Compodoc (2026-08-26)

Construida tal cual se planeó en §9 (misma arquitectura real ya probada en Dely Doggy) — 2 contenedores nuevos:

- **`omniuser_docs`** (puerto 8096, `127.0.0.1` únicamente) — MkDocs Material (`squidfunk/mkdocs-material:9.5` + plugin `mkdocs-swagger-ui-tag`), 3 páginas reales (`index.md`, `roles.md` con el detalle completo de la jerarquía del §3, `api.md` con Swagger UI real embebido).
- **`omniuser_compodoc`** (puerto 8097, `127.0.0.1` únicamente) — documentación autogenerada del backend completo (`npx compodoc -p tsconfig.json -d documentation -s -w`), parseando los comentarios TSDoc reales del código (ver `PLAN_DESARROLLO.md` §7 — el estándar de comentarios de este proyecto existe justo para esto).

**`ALLOWED_ORIGINS` del backend** ganó `http://localhost:8096` — sin esto, el navegador bloquea la petición real que `api.md` hace a `http://localhost:3030/api-json` (CORS). Hallazgo real recordado de la sesión anterior de Dely Doggy: `docker compose restart` NO relee variables de entorno nuevas — hizo falta `--force-recreate` en `omniuser_backend` para que el `ALLOWED_ORIGINS` nuevo surtiera efecto real.

**A diferencia de Dely Doggy** (cuyo `mkdocs.yml` real incluye `roles.md` en el nav pero el archivo nunca se escribió — hallazgo encontrado al investigar esta misma arquitectura, nunca corregido allá), aquí `roles.md` sí se escribió completo desde el principio — mismo contenido real que `DOCUMENTO_VIVO_ARQUITECTURA.md` §3, en formato de referencia rápida.

**Verificado real, con Playwright — nunca solo "responde 200"**: portal real navegado (Inicio, Jerarquía de roles, API), Swagger UI real mostrando los endpoints reales del backend (`OmniUser — API`, `OAS 3.0`, con `/auth/register`, `/auth/login/step1`, etc. reales); Compodoc real mostrando el grafo real del proyecto (9 módulos, 6 controllers, 11 injectables, 13 classes, 1 guard, 31 interfaces); y, lo más importante, confirmado que Compodoc SÍ parsea los comentarios TSDoc reales — la página real de `UsersService` muestra, tal cual, el comentario de documentación real escrito en `users.service.ts` (no un resumen genérico, el texto exacto).

*(Próxima entrada: lo que siga después de esta fase — ver `PLAN_DESARROLLO.md` para lo pendiente real: `PRUEBAS_SEGURIDAD.md` real contra este código, pruebas automatizadas, Fase 2 de login con Google OAuth si se pide.)*

## 6. Pruebas automatizadas reales — `jest`, 25 tests, sin mocks de Prisma (2026-08-26)

Cierra el último pendiente de los 4 identificados tras completar Etapa 1 + jerarquía: `APRENDIZAJE.md` → portal de documentación → `PRUEBAS_SEGURIDAD.md` → **pruebas automatizadas**, en ese orden explícito pedido por el dueño.

**2 niveles reales, mismo criterio "sin atajos simulados" del resto del proyecto:**

- **Funciones puras** (`common/utils/*.spec.ts`) — sin ninguna dependencia externa, corren instantáneo: `totp.util.spec.ts` (RFC 6238 real vía `otplib` — incluye el caso real que probaría un bug de "cualquier código pasa": un código válido de OTRO secreto se rechaza), `crypto.util.spec.ts` (AES-256-GCM real — el mismo secreto cifrado 2 veces da resultados distintos por el IV aleatorio, y un solo byte manipulado en el texto cifrado hace que el `authTag` real de GCM rechace el descifrado), `escape-html.util.spec.ts` (payload real de XSS neutralizado).
- **Integración real contra Postgres** (`users/users.service.spec.ts`, `roles/roles.service.spec.ts`) — `TestingModule` de NestJS con `PrismaService` REAL (nunca un mock de Prisma), conectado al mismo Postgres de desarrollo. Prueba exactamente la lógica de jerarquía del §3: un actor no puede crear/gestionar una cuenta o un rol de nivel igual/superior al suyo (incluye el caso real de auto-escalación y el de editar sin cambiar rol, solo `is_active`), `max_count` real se respeta contra cuentas activas, un rol `is_system` no puede perder su `level`/`max_count` por esta vía. Cada `it` que espera un rechazo también confirma en Postgres que el estado real no cambió — nunca basta con que se haya lanzado el error esperado. `afterAll` borra los datos de prueba reales creados (confirmado vacío después con `psql` directo).

**2 hallazgos reales de infraestructura — nuevos en este proyecto, ningún hermano (Espiral/Dely Doggy) los había topado porque ninguno tiene todavía un `*.spec.ts` que importe `PrismaService`:**

1. El cliente Prisma 7 generado (`generated/prisma/client.ts`) usa imports relativos con extensión `.js` explícita (`import * as $Class from "./internal/class.js"` — estilo de salida ESM de TypeScript moderno), pero en disco solo existe el `.ts` fuente. Jest, en modo CommonJS con `moduleFileExtensions: ["js","json","ts"]`, busca literalmente un archivo `.js` y falla con `Cannot find module`. Arreglo real, mínimo, documentado por el propio `ts-jest` para este caso exacto: `"moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" }` en el `jest` de `package.json` — reescribe cualquier import relativo terminado en `.js` quitándole la extensión, dejando que la resolución normal de Jest encuentre el `.ts`.
2. Con eso resuelto, apareció un segundo error real: `A dynamic import callback was invoked without --experimental-vm-modules` — el motor de consultas de Prisma 7 (WASM, incluso usando el adaptador `pg`) usa un `import()` dinámico interno, y el contexto VM que usa Jest para correr el código no soporta `import()` dinámico salvo que Node arranque con `--experimental-vm-modules`. Arreglo real: agregado a los 4 scripts `test`/`test:watch`/`test:cov`/`test:e2e` de `package.json` (`NODE_OPTIONS=--experimental-vm-modules jest ...`), para que correr `npm test` ya lo incluya siempre — nadie tiene que recordarlo a mano ni pasarlo por línea de comandos.

**Resultado real, verificado dentro del contenedor (`docker compose exec omniuser_backend npm test`):**
```
Test Suites: 5 passed, 5 total
Tests:       25 passed, 25 total
```

*(Con esto, los 4 pendientes identificados el 2026-08-26 para considerar Etapa 1 + jerarquía "terminados" están completos. Próxima entrada: Fase 2 de login con Google OAuth, si se pide.)*
