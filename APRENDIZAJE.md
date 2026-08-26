# Bitácora de Aprendizaje — OmniUser (Login)

> A diferencia de Espiral/Dely Doggy (donde esta bitácora es un extra), aquí es el propósito central del proyecto: el dueño pidió explícitamente un proyecto para estudiar código real. Cada entrada explica un concepto real usado en ESTE proyecto — el *por qué*, con el archivo/línea real como ejemplo, nunca una definición genérica de libro. Se referencia el código real; si algo cambia, vuelve aquí a actualizar el ejemplo.

---

## 1. Por qué 2 tokens de sesión, no 1

`AuthService.issueTokenPair` (`omniuser_backend/src/auth/auth.service.ts`) siempre crea **dos** cosas distintas al terminar un login:

- **Access token** — un JWT real (`this.jwtService.signAsync(payload, ...)`), vive poco (`JWT_ACCESS_EXPIRES_IN=15m`). Va firmado, no cifrado: cualquiera puede *leer* su contenido (es solo Base64), lo que la firma impide es que alguien lo *falsifique* sin conocer `JWT_SECRET`.
- **Refresh token** — NO es un JWT. Es puro azar de alta entropía (`crypto.randomBytes(64)`), vive semanas (`JWT_REFRESH_EXPIRES_IN=7d`), y solo su **hash** SHA-256 se guarda en Postgres (`refresh_tokens.token_hash`) — el valor real nunca se puede recuperar de la base de datos, ni por alguien con acceso directo a ella.

**¿Por qué 2, y no un solo token que dure 7 días?** Porque un JWT no se puede "revocar" a medio camino — una vez firmado, es válido hasta que expira por sí solo, aunque el servidor "cambie de opinión" (desactive la cuenta, le cambie el rol). Si el único token durara 7 días, desactivar una cuenta comprometida tardaría hasta 7 días en surtir efecto real. Con el access token de vida corta (15 min) + el refresh token real guardado en Postgres (que SÍ se puede revocar de inmediato — ver punto 2), el peor caso real de "until it expires" se reduce a 15 minutos, no 7 días — y el usuario nunca tiene que volver a escribir su contraseña cada 15 minutos, porque el refresh token se lo renueva solo (`POST /auth/refresh`).

## 2. Rotación de refresh token con "ventana de gracia" — el problema real que resuelve

Cada vez que se usa un refresh token (`AuthService.refresh`), se marca `revoked:true` y se crea uno NUEVO — nunca se reutiliza el mismo valor dos veces. Esto se llama **rotación**, y existe para poder detectar un robo real: si alguien roba tu refresh token y lo usa, y DESPUÉS tú (el dueño real) intentas usar el tuyo (que el ladrón ya "gastó"), el sistema ve un token ya revocado siendo reusado — señal real de que algo anda mal.

El problema real que la rotación sola no resuelve: si tienes 2 pestañas del navegador abiertas, y ambas intentan refrescar la sesión casi al mismo tiempo, la SEGUNDA pestaña en llegar encuentra el token ya revocado por la primera — aunque nadie te robó nada, solo perdiste una carrera de milisegundos. Sin arreglo, la segunda pestaña te cerraría la sesión por error.

La solución real (`REFRESH_TOKEN_GRACE_MS = 30_000` en `auth.service.ts`): si el token revocado se usó hace MENOS de 30 segundos, se asume la carrera de pestañas (inofensiva) y se deja pasar igual, emitiendo un par de tokens nuevo. Si pasó MÁS de 30 segundos, ya no es creíble que sea una carrera — es la señal real de robo, y ahí sí se revocan TODAS las sesiones activas de la cuenta de una vez (`updateMany({ where: { user_id, revoked: false }, data: { revoked: true } })`).

## 3. Cookies httpOnly — por qué nunca `localStorage`

Los tokens viajan en cookies con `httpOnly: true` (`AuthController.setSessionCookies`), nunca se guardan en `localStorage`. La razón real: `localStorage` es legible por CUALQUIER JavaScript que corra en la página — incluido un script malicioso inyectado por un XSS (Cross-Site Scripting) real, si algún día existiera uno. Una cookie `httpOnly` es literalmente invisible para JavaScript (`document.cookie` no la muestra) — el navegador la manda sola en cada request, sin que ningún script (legítimo o no) pueda leerla ni copiarla.

`sameSite: 'lax'` es la segunda capa: la cookie viaja en navegación normal dentro del mismo sitio, pero NO se manda automáticamente si un sitio externo intenta usarla (mitiga CSRF real). `secure: isProd` exige HTTPS real en producción (en desarrollo local, sin HTTPS, se desactiva para no romper `http://localhost`).

## 4. Hash vs. cifrado — 2 mecanismos reales, para 2 problemas distintos

Este proyecto usa AMBOS, a propósito, porque resuelven problemas diferentes:

- **Hash de una vía (`bcryptjs`)** — usado para `password_hash` y `totp_recovery_codes.code_hash`. El servidor NUNCA necesita volver a leer la contraseña real, solo comparar ("¿lo que escribiste coincide con lo guardado?"). `bcrypt.compare(password, hash)` recalcula el hash del intento y lo compara — el original es matemáticamente imposible de reconstruir desde el hash.
- **Cifrado simétrico reversible (AES-256-GCM, `common/utils/crypto.util.ts`)** — usado SOLO para `users.totp_secret_encrypted`. Aquí el servidor SÍ necesita poder leer el secreto real de vuelta, porque verificar un código de 2FA requiere calcular el código esperado a partir del secreto real (ver punto 5) — un hash no serviría, porque nunca podrías "deshacerlo" para hacer ese cálculo. La llave de cifrado (`TOTP_ENCRYPTION_KEY`) vive aparte de `JWT_SECRET` a propósito — son responsabilidades distintas, y mezclarlas significa que comprometer una compromete la otra.

## 5. 2FA real (TOTP, RFC 6238) — cómo funciona de verdad

TOTP = *Time-based One-Time Password*. La idea real: el servidor y tu app de 2FA (Google Authenticator, Authy…) comparten un mismo secreto (generado una vez, en `TwoFactorService.setup`), y AMBOS calculan, de forma independiente, el mismo código de 6 dígitos cada 30 segundos — usando el secreto + la hora actual como entrada de una función criptográfica (HMAC-SHA1). Nunca viaja ningún código "correcto" por la red durante el setup — solo el secreto (una vez, cifrado en tránsito por HTTPS) y después, en cada login, el código de 6 dígitos que YA calculó tu teléfono.

**El challenge token — el problema real que resuelve** (`AuthService.loginStep2`/`loginStep3`): si una cuenta tiene 2FA activo, el paso 2 (contraseña correcta) TODAVÍA no debe dejarte entrar — falta el paso 3. Pero el servidor necesita "recordar" que ya pasaste el paso 2 mientras esperas que escribas el código. La solución real es un JWT de corta vida (5 min) con un campo real `purpose: 'two_factor_challenge'` — nunca tiene `role`, así que aunque alguien lo robara, `JwtStrategy.validate()` lo rechazaría en cualquier endpoint real protegido (`if (!payload?.role) throw new UnauthorizedException()`) — confirmado real con `curl` durante la construcción: ese token da 401 en `/auth/me`.

**Códigos de recuperación** — 10 códigos de un solo uso reales, para cuando pierdes el teléfono. Se guardan HASHEADOS (como una contraseña, nunca en texto plano) porque, igual que una contraseña, el servidor nunca necesita volver a mostrártelos — solo comparar si el que escribiste coincide con alguno sin usar.

## 6. 2 capas reales de defensa contra abuso — no son lo mismo

- **Rate limiting (`@Throttle`, `ThrottlerModule`)** — un límite CIEGO por IP (ej. 5 intentos de login por minuto). No sabe si el intento fue exitoso o no, solo cuenta peticiones. Protege contra un script que dispara peticiones muy rápido.
- **Detección de fuerza bruta (`SecurityEventsService`)** — cuenta específicamente los intentos FALLIDOS (login, 2FA), con una ventana de 15 minutos en Redis, y solo escribe una fila real en Postgres + manda una alerta por correo cuando se cruza un umbral real (5 fallos). A diferencia del rate limit, esto sí "entiende" el contexto (falló vs. tuvo éxito) y deja un rastro real para que un humano lo revise.

Las 2 capas son necesarias juntas: el rate limit frena el volumen bruto de inmediato; la detección de fuerza bruta avisa que ALGUIEN específico está siendo atacado (o atacando), incluso si nunca llegó a disparar el límite de velocidad.

## 7. RBAC: roles dinámicos + jerarquía real de niveles

`RolesGuard` (`auth/guards/roles.guard.ts`) es la puerta GRUESA: revisa si tu rol está en la lista literal `@Roles('admin','director','super')` de un endpoint — sin eso, cualquiera autenticado entra. Esto por sí solo NO alcanza para una jerarquía real: no le dice nada a un endpoint sobre "quién puede gestionar a quién" DENTRO de los roles ya permitidos.

Por eso `UsersService.assertCanManageRole` agrega una regla FINA, real, encima del guard: cada rol tiene un `level` (0 a 5) guardado en Postgres, y la regla es simple — **solo puedes gestionar una cuenta o un rol de nivel ESTRICTAMENTE MENOR al tuyo**. Un Admin (nivel 3) puede crear Staff/Manager (1, 2), nunca otro Admin ni Director/Super (3, 4, 5) — ni para editarlo, ni para desactivarlo. Esto es lo que de verdad hace la jerarquía "real" y no solo nombres bonitos: el candado vive en el código, no en la buena fe de quien usa el sistema.

`max_count` (nulo = sin límite, `1` para `director`/`super`) es un candado real aparte, para cargos de una sola persona — se cuenta solo contra cuentas ACTIVAS, así que desactivar al Director real libera el cupo sin necesidad de borrar su cuenta (el proyecto nunca borra cuentas, solo desactiva — preserva el historial real).

## 8. Prisma: por qué "cambiar el schema" son en realidad 2 pasos reales

Un error real que tuvimos al construir esto (ver `DOCUMENTO_VIVO_ARQUITECTURA.md` §2): editar `schema.prisma` NO alcanza por sí solo. Hacen falta 2 cosas reales, siempre:

1. **`npx prisma migrate dev --name algo`** — genera el archivo SQL real (`prisma/migrations/.../migration.sql`) que de verdad transforma las tablas de Postgres, y lo aplica.
2. **`npx prisma generate`** — regenera el CLIENTE de TypeScript (`generated/prisma/`) que el código usa para hablarle a la base de datos con autocompletado y tipos reales.

`migrate dev` normalmente hace ambas cosas en un solo comando — pero si algo falla a medio camino (como nos pasó), puedes terminar con la migración real aplicada en Postgres pero el cliente de TypeScript todavía sin enterarse de los campos nuevos (`level`/`max_count`) — el código compila con datos viejos aunque la base de datos ya tenga los nuevos. La señal real de que esto pasó: errores de TypeScript tipo `Property 'level' does not exist` después de una migración que "sí corrió bien".

## 9. Arquitectura real de Docker Compose de este proyecto

4 contenedores reales, cada uno con una sola responsabilidad (nunca "un contenedor gigante que hace todo"):

- `omniuser_db` (Postgres) y `omniuser_redis` — solo datos, expuestos SOLO a `127.0.0.1` (nunca a la red, ver `docker-compose.yml`) — ni siquiera otra máquina en tu misma red local podría conectarse directo a la base de datos.
- `omniuser_backend` — la API real (NestJS). Monta el código como volumen (`./omniuser_backend:/usr/src/app`) para hot-reload real en desarrollo — cambias un archivo en tu editor, el servidor se reinicia solo, sin reconstruir la imagen entera.
- `omniuser_frontend` — Next.js, mismo criterio de volumen para hot-reload.

Los 4 se comunican por una red interna de Docker (`omniuser_network`) usando el NOMBRE del servicio como si fuera un dominio real (`omniuser_backend:3000` desde dentro de la red) — nunca `localhost`, que dentro de un contenedor se refiere al contenedor mismo, no a sus vecinos.

## 10. Por qué las pruebas de jerarquía usan Postgres real, no un Prisma simulado

`users/users.service.spec.ts` y `roles/roles.service.spec.ts` NO usan un mock de `PrismaService` (algo como `{ findUnique: jest.fn().mockResolvedValue(...) }`). Usan el `PrismaService` REAL, conectado al mismo Postgres real de desarrollo, dentro de un `TestingModule` de NestJS. La razón real: un mock solo prueba que el código llama a Prisma con los argumentos que TÚ programaste que esperara — nunca prueba que la consulta real, contra una base de datos real, con datos reales, produce el resultado correcto. La regla que se prueba aquí (`assertCanManageRole`) depende de datos reales en Postgres (`roles.level`, cuántas cuentas activas tiene cada rol) — un mock la volvería una prueba de "¿programé el mock bien?", no de "¿la regla de negocio real funciona?".

El costo real de esto: cada prueba debe limpiar después de sí misma (`afterAll` con `deleteMany` sobre los datos de prueba creados, confirmado vacío con una consulta directa) — a diferencia de un mock, que no deja rastro porque nunca tocó nada real. Es un costo aceptado a propósito, mismo criterio de "sin atajos simulados" de todo el proyecto.

**Hallazgo real de infraestructura en el camino** (nuevo en este proyecto — ni Espiral ni Dely Doggy lo habían topado, porque ninguno tiene todavía un test que importe `PrismaService`): el cliente de Prisma 7 generado usa dos mecanismos que Jest, por defecto, no soporta.

1. Sus imports internos usan extensión `.js` explícita (`import * as $Class from "./internal/class.js"`) aunque en disco solo existe el `.ts` — un patrón de salida ESM moderno de TypeScript. Jest, corriendo en modo CommonJS, busca literalmente un archivo `.js` y no lo encuentra. Se resuelve diciéndole a Jest que reescriba cualquier import relativo terminado en `.js` quitándole la extensión (`moduleNameMapper` en el `jest` de `package.json`), para que la resolución normal encuentre el `.ts`.
2. El motor de consultas de Prisma 7 usa un `import()` dinámico internamente (incluso usando el adaptador `pg`, no el motor binario clásico) — y el entorno aislado (VM) donde Jest ejecuta el código de cada test no soporta `import()` dinámico salvo que Node arranque con la bandera `--experimental-vm-modules`. Se agregó esa bandera a los 4 scripts `test*` de `package.json`, para que `npm test` ya la incluya siempre.

La lección real detrás de ambos: una herramienta (Jest) diseñada originalmente para CommonJS y una librería (Prisma 7) que ya genera código con convenciones de módulos ESM modernas no siempre encajan solas — el error que se ve (`Cannot find module`, `dynamic import callback...`) rara vez explica la causa real por sí solo; hace falta entender qué sistema de módulos espera cada lado.
