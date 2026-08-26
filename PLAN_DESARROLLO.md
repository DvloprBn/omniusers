# Plan de Desarrollo — OmniUser (módulo Login)

> Estrategia, alcance y decisiones. Nada de esto es código todavía — estamos en modo diseño (ver `CLAUDE.md`). Este documento se actualiza conforme se resuelvan las preguntas abiertas de abajo, no de una sola vez.

## §0. Relación real con el plan de 5 proyectos — resuelto (2026-08-26)

`DocumentacionProyecto/Bridge/README.md` documenta un plan ya existente: Inari → Espiral → Dely Doggy → TecnoSolutions → OmniSkeleton, con OmniSkeleton deliberadamente al final (después de 3 negocios reales, para no abstraer con muy pocos casos).

**Confirmado por el dueño**: este proyecto (`dvlopmnt/login`) **NO vive dentro de ese plan** — es aparte. Sirve para 2 cosas reales distintas: (1) complementar esa OmniSkeleton futura (lo que se aprenda/construya aquí es insumo real para ella, igual que `Bridge/` ya lo es), y (2) ir directo al portafolio del dueño como pieza propia, terminada y funcional. El nombre "OmniUser" se queda (el dueño no pidió cambiarlo), entendiendo que es un proyecto propio y no el hito formal del plan de 5.

## §0.1 Estándar real para este proyecto — no es solo "para practicar" (2026-08-26)

El dueño fue explícito: aunque el objetivo principal es que él pueda leer TODO el código y entenderlo al grado de modificarlo sin ayuda, **el resultado debe ser cien por ciento funcional** — al grado de poder servir de base real para un proyecto de cliente si hiciera falta. Esto cambia el estándar de calidad real del proyecto contra lo que "solo para practicar" sugeriría:

- Sin atajos simulados — mismo criterio ya establecido en `CLAUDE.md`, reforzado aquí explícitamente.
- Buenas prácticas reales (OWASP, patrones ya probados en Espiral/Dely Doggy) desde el primer commit de código, no "ya lo arreglamos después".
- Debe pasar pruebas de seguridad exhaustivas — más allá del checklist ya heredado de Bridge (ver §8).
- Debe quedar documentado al nivel de que el dueño pueda leerlo solo y entenderlo — esto es un requisito de primera clase del proyecto, no un extra (ver §7).

---

## §1. Qué es este proyecto

Un sistema de acceso (login) completo y reusable — simula:
- Un **sitio público** (unas cuantas páginas de ejemplo, sin negocio real detrás).
- Una **sección de administración**, protegida por rol.
- Un mecanismo real para **simular distintos roles** (cambiar de cuenta de prueba y ver cómo cambia lo que se puede hacer/ver) — el objetivo didáctico central: ver el RBAC funcionando en vivo, no solo leerlo.

No es una tienda, no tiene catálogo/carrito/pagos — es exclusivamente la capa de identidad y acceso, aislada a propósito para poder estudiarla sin el ruido de un negocio completo alrededor.

## §2. Alcance real (primera versión)

**Backend — reutilizado casi literal de Espiral/Dely Doggy** (ver §3):
- Registro + login con correo/contraseña.
- JWT de acceso en cookie httpOnly + refresh token con rotación y ventana de gracia.
- Roles **dinámicos** (tabla `roles` editable, mismo criterio real de Espiral — ver §4, punto 3, para el porqué).
- Revocación de sesión, cambio de contraseña, recuperación de contraseña.

**Backend — genuinamente nuevo, sin precedente en Espiral ni Dely Doggy**:
- **2FA real, TOTP** (ver §4, punto 1). Ningún proyecto hermano lo tiene construido (Espiral solo reserva el nombre de un tipo de evento de seguridad, `twofactor_bruteforce`, nunca implementado).
- **Login "estilo Google"** — Fase 1: la UX (correo → siguiente → contraseña → segundo factor, en pantallas separadas). Fase 2 (después, si se pide): "Iniciar sesión con Google" real vía OAuth2/OIDC — ver §4, punto 2.

**Frontend**:
- Sitio público simulado (2-3 páginas de ejemplo).
- Login/registro con el flujo de 2FA real.
- Panel de administración simulado, con nav condicionado por rol (mismo patrón real de `RolesGuard`/`nav.tsx` de los proyectos hermanos).
- Un selector real de "iniciar sesión como" sobre cuentas de prueba con roles distintos — para ver el RBAC cambiar en vivo sin tener que loguearse/desloguearse a mano cada vez.

## §3. Qué se reutiliza literal (no se reinventa)

Puerto directo, ya probado 2 veces (Espiral → Dely Doggy), verificado con auditorías de seguridad reales en ambos:
- JWT en cookie httpOnly, `secure` en producción, algoritmo fijado explícito (`HS256`, nunca negociado).
- Rotación de refresh token con ventana de gracia + revocación en cascada de TODAS las sesiones si se detecta reuso fuera de esa ventana (hallazgo de seguridad real ya corregido 2 veces).
- `RolesGuard`/`@Roles()` a nivel de endpoint, nunca solo del lado del cliente.
- Rate limiting dedicado en login/registro/reset, por debajo del límite global de la API.
- `Bridge/CHECKLIST_SEGURIDAD_PRELANZAMIENTO.md` — se corre contra este proyecto también, antes de considerarlo "listo para estudiar/reusar".
- Mismo stack: NestJS + Prisma + PostgreSQL (backend), Next.js + React (frontend), Docker Compose — mismo criterio "misma arquitectura que hemos trabajado" pedido explícito por el dueño, sin variarlo.

## §4. Preguntas que estaban abiertas — resueltas con default razonado (2026-08-26)

El dueño pidió "comenzar" sin resolver cada una explícitamente — se avanza con el default más defendible en cada caso, declarado aquí para que se pueda corregir en cualquier momento si no es lo que se quería:

1. **2FA — TOTP real** (Google Authenticator/Authy/1Password, vía `otplib` o equivalente — estándar abierto, RFC 6238, sin depender de SMS/correo de terceros). Real desde el principio, nunca simulado — mismo criterio de "sin atajos" del §0.1.
2. **"Login estilo Google" — se separa en 2 fases reales, no se decide una sola cosa:**
   - **Fase 1 (con esto arrancamos):** la UX de Google — correo → "Siguiente" → contraseña → segundo factor, en pantallas separadas, en vez de un formulario único — sin depender de ninguna credencial externa.
   - **Fase 2 (más adelante, solo si se pide):** "Iniciar sesión con Google" real (OAuth2/OIDC) — mismo criterio que Stripe/Cloudinary en los proyectos hermanos: integración real, nunca simulada, pero necesita que el dueño genere credenciales reales en Google Cloud Console primero. Se documenta como fase aparte para no bloquear el arranque del proyecto en un trámite externo.
3. **Roles — dinámicos**, no fijos. Dado que el objetivo explícito es poder servir de base a un proyecto de cliente real (§0.1) cuyo negocio todavía no se conoce, roles dinámicos (tabla `roles` editable, como Espiral) generalizan mejor que 5 roles fijos hardcodeados (como Dely Doggy) — es más trabajo real de construir, pero es la elección correcta para un esqueleto reutilizable.
4. **Nombre del proyecto** — resuelto en §0: "OmniUser" se queda.
5. **Repositorio de git propio** — sí, desde el principio (no hasta que "haga falta"). Un proyecto pensado para el portafolio y para reutilizarse en un cliente necesita su propio historial real desde el primer commit, no heredar/mezclarse con el de Espiral o Dely Doggy.

## §7. Estándar de documentación de código — requisito de primera clase, no un extra

A diferencia de Espiral/Dely Doggy (donde el criterio por defecto es comentarios mínimos, solo cuando el *por qué* no es obvio), aquí el objetivo explícito del dueño es poder leer TODO el código y entenderlo sin ayuda — así que el estándar es el opuesto: **comentario de documentación real (TSDoc/JSDoc) en cada función/clase/módulo no trivial**, explicando:

- Qué hace (en una frase, sin repetir el nombre de la función).
- Qué espera cada parámetro (tipo + significado real, no solo el tipo).
- Qué regresa (incluidos los casos de error/excepción reales que puede lanzar).
- El *por qué*, cuando no sea obvio — igual que en los proyectos hermanos.

Esto no es cosmético: **Compodoc** (ver §9) parsea exactamente estos comentarios TSDoc para generar la documentación autogenerada del backend — escribirlos bien aquí es lo que hace que el portal de documentación sirva de verdad, no un mapa vacío.

## §8. Pruebas de seguridad exhaustivas — documento aparte, replicable

Un documento nuevo, `PRUEBAS_SEGURIDAD.md` (raíz del proyecto), además de (no en vez de) `Bridge/CHECKLIST_SEGURIDAD_PRELANZAMIENTO.md` — el checklist de Bridge es una lista de preguntas destiladas de hallazgos reales pasados; este documento nuevo es más exhaustivo: cubre sistemáticamente el **OWASP API Security Top 10** completo contra cada endpoint real que se construya, no solo los puntos que ya fallaron antes en otro proyecto.

Cada prueba documentada ahí explica, en el mismo formato: **qué vulnerabilidad prueba, por qué importa en este caso concreto, el comando/pasos exactos para reproducirla a mano (curl/Postgres/lo que aplique), y qué resultado cuenta como "pasa"** — para que el dueño pueda replicarla él mismo, no solo leer que "ya se probó". Arranca vacío (sin endpoints todavía no hay nada que probar) — se llena en paralelo a cada pieza real que se construya, nunca al final de golpe.

## §9. Documentación automatizada — misma arquitectura real que Dely Doggy

Mismo mecanismo ya probado en producción, sin inventar uno nuevo:

- **`docs/`** — portal MkDocs Material (mismo Dockerfile base que `delidogy_docs`: `squidfunk/mkdocs-material` + plugin `mkdocs-swagger-ui-tag`), sirviendo `index.md` + la referencia OpenAPI en vivo.
- **`@nestjs/swagger`** en el backend — genera el spec OpenAPI real desde los decoradores de cada controller/DTO (`/api-json`), consumido en vivo por el portal — nunca un spec escrito a mano que se desalinea del código real.
- **Compodoc** — documentación autogenerada de módulos/servicios/grafo de dependencias del backend completo, parseando los comentarios TSDoc reales del §7 — mismo comando (`npx compodoc -p tsconfig.json -d documentation -s -w`), mismo contenedor aparte.
- Ambos servicios solo en `127.0.0.1` (nunca expuestos más allá del host) — mismo criterio real ya aplicado en Dely Doggy (OWASP API8: un portal de documentación interna es, en los hechos, un mapa de la arquitectura).
- Se agregan al `docker-compose.yml` en cuanto exista un backend real que documentar — no antes (Compodoc necesita un `tsconfig.json` real para correr).

## §10. Bibliografía y referencias de estudio

Documento nuevo, `BIBLIOGRAFIA.md` (raíz del proyecto) — no solo un listado al final, sino la fuente real detrás de cada decisión de arquitectura de este proyecto (JWT, TOTP, OWASP, RBAC, Next.js/NestJS/Prisma) para que el dueño pueda ir a la fuente primaria, no solo confiar en la explicación de segunda mano. Arranca con las referencias ya relevantes al alcance decidido en este documento (ver el archivo).

## §5. Cómo se vuelve reutilizable (para cuando llegue ese momento)

- Nombres genéricos en schema/variables/paquetes — nunca atados a una marca (a diferencia de `delidogy_backend`, aquí algo como `auth_backend` o similar).
- Variables de entorno documentadas desde el `.env.example` inicial, no agregadas sobre la marcha.
- `docker-compose.yml` autocontenible, sin asumir que vive junto a otros proyectos.
- Cada decisión de diseño se evalúa también contra "¿esto generaliza a un negocio que no se parezca a Espiral/Dely Doggy, o asume implícitamente su forma?" — mismo espíritu que ya se aplicó con PWA en Dely Doggy, aplicado aquí a la reusabilidad.

## §6. Datos de prueba — regla distinta a Espiral/Dely Doggy

Sin negocio real detrás, así que sí se pueden inventar datos libremente aquí: usuarios ficticios, roles de ejemplo (`visitante`/`editor`/`moderador`/`admin`/`super`, o los que se decidan al diseñar el modelo de roles dinámico real, §4 punto 3) — la disciplina de "nunca fabricar un dato de negocio real", central en los 2 proyectos hermanos, no aplica porque no hay un negocio real que representar.
