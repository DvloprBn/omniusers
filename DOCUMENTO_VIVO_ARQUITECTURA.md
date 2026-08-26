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

*(Próxima entrada: verificación real una vez que el código exista — curl/Postgres, nunca solo "compila".)*
