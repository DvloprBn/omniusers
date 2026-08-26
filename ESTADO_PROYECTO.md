# Estado del Proyecto: OmniUser (Login)

> Documento de estado día a día. Se actualiza cada vez que se pide o al cerrar un hito.
> La estrategia y las preguntas abiertas que no cambian seguido viven en [`PLAN_DESARROLLO.md`](./PLAN_DESARROLLO.md).

> **Nota de origen (2026-08-26):** este proyecto arranca de `projects/espiral/` y `projects/delyDoggy/`, que conservan sin tocar su propia documentación real como referencia — reutilizar sus patrones probados, no copiar sus decisiones de negocio (aquí no hay negocio real). Este archivo, en cambio, **arranca vacío a propósito** — es la bitácora de este proyecto específicamente.
>
> **Antes de repetir un error ya conocido**: revisa `DocumentacionProyecto/Bridge/` — ahí vive, ya generalizado, todo lo que salió mal o costó caro en Espiral/Dely Doggy y aplica a cualquier proyecto con este mismo stack.

Última actualización: **2026-08-26** (diseño técnico completo — schema, módulos, endpoints, puertos, monorepo — listo para empezar a construir código real, ver `DOCUMENTO_VIVO_ARQUITECTURA.md` §1)

---

## 1. Dónde estamos

Nada construido todavía — diseño técnico completo (schema Prisma, flujo real de login+2FA en 3 pasos, módulos del backend, endpoints, estructura del monorepo, puertos reales asignados). Pendiente: confirmación del dueño para empezar a escribir código real (`omniuser_backend`/`omniuser_frontend`/`docker-compose.yml`).

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-08-26 | **Diseño técnico completo, todavía sin código de aplicación.** `DOCUMENTO_VIVO_ARQUITECTURA.md` §1: schema real (`roles` dinámicos, `users` con 2FA cifrado, `refresh_tokens`/`totp_recovery_codes`/`password_reset_tokens`/`security_events`, mismo patrón real ya auditado en los hermanos); flujo real de login en 3 pasos (correo → contraseña → 2FA si aplica, con challenge token de corta vida entre pasos, nunca emite sesión real hasta terminar); 6 módulos reales de backend (`auth`/`two-factor`/`roles`/`users`/`security-events`/infraestructura); 15 endpoints reales listados; estructura de monorepo (`omniuser_backend`/`omniuser_frontend`/`docs`); puertos reales asignados siguiendo la secuencia ya usada en este host (3030/3031 app, 5436 Postgres, 6381 Redis, 5521 Prisma Studio, 8096/8097 docs/Compodoc — nunca chocan con Inari/Espiral/Dely Doggy). |
| 2026-08-26 | **Estrategia real definida — sigue sin código de aplicación, a propósito (modo diseño).** Confirmado con el dueño: este proyecto vive aparte del plan de 5 (Inari→Espiral→Dely Doggy→TecnoSolutions→OmniSkeleton) documentado en `Bridge/README.md` — complementa esa OmniSkeleton futura y además va al portafolio del dueño como pieza propia. Aunque el objetivo principal es que el dueño lea y entienda todo el código sin ayuda, el resultado debe ser cien por ciento funcional, al grado de servir de base real a un proyecto de cliente. Decisiones reales tomadas: roles **dinámicos** (no fijos, para generalizar mejor a un cliente desconocido); 2FA real **TOTP** (RFC 6238) desde el arranque; login "estilo Google" en 2 fases (Fase 1: UX de pasos separados, sin credenciales externas; Fase 2 futura: OAuth real, requiere que el dueño genere credenciales en Google Cloud); repositorio de git propio desde el primer commit (no compartido con Espiral/Dely Doggy). **2 requisitos nuevos que cambian cómo se construye todo lo que sigue**: (1) estándar de comentarios de código INVERTIDO contra Espiral/Dely Doggy — aquí TODA función/clase no trivial lleva TSDoc/JSDoc real (qué hace/espera/regresa), porque Compodoc los va a parsear para el portal de documentación real; (2) pruebas de seguridad exhaustivas documentadas aparte (`PRUEBAS_SEGURIDAD.md`, nuevo — cubre sistemáticamente el OWASP API Security Top 10, no solo el checklist ya heredado de hallazgos pasados), cada una con los pasos exactos para que el dueño la replique él mismo. También nuevos: `BIBLIOGRAFIA.md` (fuentes reales — RFCs de JWT/TOTP/OAuth, OWASP, docs oficiales del stack) y el plan de documentación autogenerada (`PLAN_DESARROLLO.md` §9 — misma arquitectura real de `delidogy_docs`/`delidogy_compodoc`: MkDocs + Swagger UI en vivo + Compodoc, se agrega al `docker-compose.yml` en cuanto exista backend real). Repositorio git local inicializado (`.gitignore` copiado/adaptado de Dely Doggy), sin remoto todavía. |
