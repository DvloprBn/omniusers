# Pruebas de Seguridad — OmniUser (Login)

> Complementa (no reemplaza) `DocumentacionProyecto/Bridge/CHECKLIST_SEGURIDAD_PRELANZAMIENTO.md`. Ese checklist es una lista de preguntas destiladas de hallazgos reales que ya fallaron antes en otro proyecto — este documento es más exhaustivo: cubre sistemáticamente el **OWASP API Security Top 10** completo contra cada endpoint real de este backend.
>
> **Formato de cada prueba** (para que la puedas replicar tú mismo, no solo leer que "ya se probó"):
> 1. **Qué vulnerabilidad prueba** y por qué importa en este caso concreto.
> 2. **Cómo reproducirla a mano** — comando exacto.
> 3. **Qué cuenta como "pasa"**.
> 4. **Resultado real** — la fecha en que se corrió y qué pasó de verdad.
>
> Todas las pruebas de este documento se corrieron el **2026-08-26** contra el backend real (`http://localhost:3030`), con datos de prueba creados y borrados después de cada una (nunca se dejó nada real a medias). Para replicarlas, arranca el stack (`docker compose up -d`) y usa las cuentas sembradas (`prisma/seed.ts`, password `TestOnly123!`) o crea las tuyas.

## OWASP API Security Top 10 (2023)

| # | Categoría | Aplica | Estado |
|---|---|---|---|
| API1 | Broken Object Level Authorization (IDOR) | Sí | ✅ Probado |
| API2 | Broken Authentication | Sí — el núcleo del proyecto | ✅ Probado |
| API3 | Broken Object Property Level Authorization | Sí | ✅ Probado |
| API4 | Unrestricted Resource Consumption | Sí | ✅ Probado |
| API5 | Broken Function Level Authorization | Sí | ✅ Probado |
| API6 | Unrestricted Access to Sensitive Business Flows | Parcial | ✅ Probado (ver nota) |
| API7 | Server Side Request Forgery (SSRF) | Solo si existe Fase 2 (Google OAuth) | No aplica todavía |
| API8 | Security Misconfiguration | Sí | ✅ Probado |
| API9 | Improper Inventory Management | Sí | ✅ Verificado por código (ver nota) |
| API10 | Unsafe Consumption of APIs | Solo si existe Fase 2 (Google OAuth) | No aplica todavía |

---

## API1 — Broken Object Level Authorization (IDOR)

**Qué prueba**: que una cuenta sin autoridad real no pueda leer/modificar los datos de OTRA cuenta cambiando un `:id` en la URL.

**Cómo reproducirla**:
```bash
# Login como staff (nivel 1)
curl -c c.txt -X POST http://localhost:3030/auth/login/step2 -H 'Content-Type: application/json' \
  -d '{"email":"staff+omniuser@example.com","password":"TestOnly123!"}'

# Intentar desactivar la cuenta real de manager (otra persona, nivel 2)
curl -b c.txt -X PATCH http://localhost:3030/users/<UUID-REAL-DE-MANAGER> -H 'Content-Type: application/json' \
  -d '{"is_active":false}'
```

**Qué cuenta como "pasa"**: `403 Forbidden` — nunca `200`.

**Resultado real (2026-08-26)**: `403 {"message":"Forbidden resource"}` — `RolesGuard` rechaza a `staff` antes siquiera de llegar al service (`@Roles('admin','director','super')` en `UsersController`). ✅

---

## API2 — Broken Authentication

### 2.1 El challenge token del paso 2 (2FA) nunca sirve como sesión real

**Qué prueba**: que completar solo el paso 2 (contraseña) de una cuenta con 2FA activo NUNCA deja entrar a ningún endpoint protegido — ni siquiera `/auth/me`.

**Cómo reproducirla**: activar 2FA real en una cuenta de prueba (`POST /two-factor/setup` + `confirm-setup` con un código TOTP real), luego:
```bash
curl -c c.txt -X POST http://localhost:3030/auth/login/step2 -H 'Content-Type: application/json' \
  -d '{"email":"<cuenta-con-2fa>","password":"<password-real>"}'
# responde {"requiresTwoFactor":true} — usa la MISMA cookie jar (trae el challenge token)
curl -b c.txt http://localhost:3030/auth/me
curl -b c.txt http://localhost:3030/users
```

**Qué cuenta como "pasa"**: `401` en ambos, sin importar el endpoint.

**Resultado real (2026-08-26)**: `401 {"message":"Unauthorized"}` en `/auth/me` y en `/users`. `JwtStrategy.validate()` rechaza el challenge token porque nunca trae `role` en su payload — un ladrón que robara este token no podría usarlo en ningún endpoint real. ✅

### 2.2 Anti-enumeración de cuentas (login y forgot-password)

**Qué prueba**: que el mensaje de error NUNCA revele si un correo existe o no — si lo revelara, alguien podría usar el login como "oráculo" para armar una lista real de correos válidos antes de intentar adivinar contraseñas.

**Cómo reproducirla**:
```bash
curl -X POST http://localhost:3030/auth/login/step2 -H 'Content-Type: application/json' -d '{"email":"noexiste@example.com","password":"x"}'
curl -X POST http://localhost:3030/auth/login/step2 -H 'Content-Type: application/json' -d '{"email":"admin+omniuser@example.com","password":"contraseñaequivocada"}'
curl -X POST http://localhost:3030/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"noexiste@example.com"}'
curl -X POST http://localhost:3030/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"admin+omniuser@example.com"}'
```

**Qué cuenta como "pasa"**: los 2 mensajes de login son byte-por-byte idénticos entre sí; los 2 de forgot-password también.

**Resultado real (2026-08-26)**: login → `{"message":"Credenciales inválidas"}` en ambos casos. forgot-password → `{"message":"Si el correo existe, te llegó un link para restablecer tu contraseña."}` en ambos casos. ✅

### 2.3 Logout revoca la sesión en el SERVIDOR, no solo borra la cookie

**Qué prueba**: que cerrar sesión invalide el refresh token real en Postgres — si solo borrara la cookie del navegador, alguien con el valor real del token (robado antes) seguiría pudiendo usarlo.

**Cómo reproducirla**:
```bash
curl -c c.txt -X POST http://localhost:3030/auth/login/step2 -H 'Content-Type: application/json' -d '{"email":"usuario+omniuser@example.com","password":"TestOnly123!"}'
curl -c c.txt -b c.txt -X POST http://localhost:3030/auth/refresh   # confirma que el token sirve
curl -c c.txt -b c.txt -X POST http://localhost:3030/auth/logout
curl -b c.txt -X POST http://localhost:3030/auth/refresh            # reintenta con el MISMO archivo de cookies
```

**Qué cuenta como "pasa"**: el refresh de después del logout da `401`, aunque el navegador siga "teniendo" la cookie.

**Resultado real (2026-08-26)**: refresh antes de logout → `200 {"ok":true}`. Refresh después de logout, misma cookie → `401 {"message":"Unauthorized"}`. Confirma que `AuthService.logout` marca el token `revoked:true` en Postgres de verdad. ✅

---

## API3 — Broken Object Property Level Authorization (mass assignment)

**Qué prueba**: que un campo NO declarado en el DTO (ej. intentar mandar `role_id` en un registro público, para autoasignarse un rol con autoridad) se rechace de plano, en vez de ignorarse en silencio o — peor — aceptarse.

**Cómo reproducirla**:
```bash
curl -X POST http://localhost:3030/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"prueba@example.com","password":"Password123!","role_id":1}'
```

**Qué cuenta como "pasa"**: `400 Bad Request` explícito sobre el campo extra — nunca un `201` que lo haya ignorado silenciosamente (eso dejaría creer que funcionó cuando en realidad se ignoró) ni, mucho peor, un `201` que de verdad haya asignado ese rol.

**Resultado real (2026-08-26)**: `400 {"message":["property role_id should not exist"]}` — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` en `main.ts` lo rechaza antes de que el controller lo vea siquiera. ✅

---

## API4 — Unrestricted Resource Consumption (rate limiting)

**Qué prueba**: que un script no pueda probar contraseñas o códigos 2FA a alta velocidad.

**Cómo reproducirla**:
```bash
for i in 1 2 3 4 5 6; do
  curl -w "intento $i: HTTP %{http_code}\n" -o /dev/null -X POST http://localhost:3030/auth/login/step2 \
    -H 'Content-Type: application/json' -d '{"email":"x@example.com","password":"y"}'
done
```

**Qué cuenta como "pasa"**: los primeros 5 responden `401`/`200` según corresponda, el 6to (dentro del mismo minuto) responde `429`.

**Resultado real (2026-08-26)**: confirmado real en **2 endpoints distintos** — `/auth/login/step2` (durante la verificación de la Etapa 1, el límite se agotó solo con las pruebas normales de esa sesión) y `/auth/login/2fa` (5 códigos reales incorrectos → los 5 dieron `401 "Código inválido"`, el 6to dio `429 "ThrottlerException: Too Many Requests"`, confirmado en esta ronda). ✅

**Extra real, más allá del rate limit ciego**: los 5 intentos fallidos reales de 2FA generaron una fila real en `security_events` (`type: 'twofactor_bruteforce', attempts: 5, status: 'nuevo'`), confirmada directo en Postgres — la detección de fuerza bruta (capa aparte del rate limit, ver `APRENDIZAJE.md` §6) también funciona real. ✅

---

## API5 — Broken Function Level Authorization

**Qué prueba**: que un rol sin autoridad real no pueda llamar un endpoint de administración, aunque esté autenticado.

**Cómo reproducirla**: con la sesión de `staff` del API1,
```bash
curl -b c.txt http://localhost:3030/users
curl -b c.txt -X POST http://localhost:3030/roles -H 'Content-Type: application/json' -d '{"name":"prueba"}'
```

**Qué cuenta como "pasa"**: `403` en ambos.

**Resultado real (2026-08-26)**: `403 {"message":"Forbidden resource"}` en ambos — `RolesGuard` con `@Roles('admin','director','super')`. ✅

**Prueba complementaria real — un rol nuevo, vacío, de verdad no hereda nada**: se creó un rol real (`prueba_vacio`, `level:0`, sin ningún `@Roles(...)` que lo mencione) y una cuenta real con ese rol. **Hallazgo de metodología en el camino**: la primera corrida dio `403` en todo, pero por la contraseña temporal (`must_change_password:true`), no por el rol — corregido cambiando la contraseña real primero (`PATCH /auth/me/password`) antes de repetir la prueba limpia. Resultado real limpio: `/users` → `403`, `/roles` → `403`, `/security-events` → `403`, `/auth/me` (sin restricción de rol) → `200`. Confirma que un rol nuevo nunca hereda autoridad por accidente — el catálogo de roles y los permisos reales son 2 cosas separadas (ver `PLAN_DESARROLLO.md` §4, punto 3). ✅

---

## API6 — Unrestricted Access to Sensitive Business Flows

**Qué prueba**: que crear cuentas en masa (el flujo real más sensible de este proyecto, al no haber pagos/pedidos) esté limitado.

**Verificado por el mismo mecanismo ya probado en API4** (no se repitió cargando 10 registros reales para no ensuciar la base de datos de prueba sin necesidad): `AuthController.register` tiene `@Throttle({ default: { limit: 10, ttl: seconds(3600) } })` — mismo `ThrottlerGuard` real ya confirmado funcionando en API4, aplicado aquí con una ventana de 1 hora en vez de 1 minuto (el abuso real de un registro masivo es de volumen por hora, no por segundo). ✅ (verificado por código + el mecanismo base ya probado en vivo, no por una corrida separada de 10 registros reales)

---

## API8 — Security Misconfiguration

**Qué prueba**: cabeceras de seguridad reales, y que CORS rechace un origen no autorizado.

**Cómo reproducirla**:
```bash
curl -I http://localhost:3030/health | grep -iE "x-frame|x-content-type|strict-transport|x-powered-by"
curl -I -H "Origin: http://evil.example.com" http://localhost:3030/health | grep -i "access-control"
curl -I -H "Origin: http://localhost:3031" http://localhost:3030/health | grep -i "access-control"
```

**Qué cuenta como "pasa"**: `X-Frame-Options`/`X-Content-Type-Options`/`Strict-Transport-Security` presentes, `X-Powered-By` AUSENTE; sin `Access-Control-Allow-Origin` para el origen no autorizado; SÍ presente (y exacto) para el autorizado.

**Resultado real (2026-08-26)**:
- `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` — presentes (`helmet`).
- `X-Powered-By` — ausente.
- Origen `http://evil.example.com` → sin `Access-Control-Allow-Origin` en la respuesta (el navegador bloquearía la lectura real).
- Origen `http://localhost:3031` → `Access-Control-Allow-Origin: http://localhost:3031` real. ✅

---

## API9 — Improper Inventory Management

**Qué prueba**: que el spec completo de la API (`/api-json`, mapa real de cada ruta/DTO — información de reconocimiento útil para un atacante) no quede expuesto en producción.

**Verificado por revisión de código, no en runtime** (este ambiente sigue en modo desarrollo — flipearlo a `NODE_ENV=production` en vivo reconstruiría el stack completo sin necesidad real para esta prueba puntual): `main.ts` envuelve el registro de `/api-json` en `if (process.env.NODE_ENV !== 'production')` — en producción esa ruta ni siquiera se registra en el router de Nest. Pendiente real: confirmar esto en vivo el día que exista un build de producción real (Dockerfile sin sufijo `.dev`, todavía no construido).

---

## Pendiente real de este documento

- **API7/API10 (SSRF / consumo inseguro de APIs)**: no aplican todavía — solo entrarían en juego con la Fase 2 (login real con Google OAuth), que hace una llamada saliente real a la API de Google. Se llenan cuando esa fase se construya, no antes.
- **API9 en runtime real**: pendiente de un build de producción real para confirmarlo en vivo, no solo por lectura de código.
