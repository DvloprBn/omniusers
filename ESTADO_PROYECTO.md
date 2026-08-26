# Estado del Proyecto: Omniskeleton (Login)

> Documento de estado día a día. Se actualiza cada vez que se pide o al cerrar un hito.
> La estrategia y las preguntas abiertas que no cambian seguido viven en [`PLAN_DESARROLLO.md`](./PLAN_DESARROLLO.md).

> **Nota de origen (2026-08-26):** este proyecto arranca de `projects/espiral/` y `projects/delyDoggy/`, que conservan sin tocar su propia documentación real como referencia — reutilizar sus patrones probados, no copiar sus decisiones de negocio (aquí no hay negocio real). Este archivo, en cambio, **arranca vacío a propósito** — es la bitácora de este proyecto específicamente.
>
> **Antes de repetir un error ya conocido**: revisa `DocumentacionProyecto/Bridge/` — ahí vive, ya generalizado, todo lo que salió mal o costó caro en Espiral/Dely Doggy y aplica a cualquier proyecto con este mismo stack.

Última actualización: **2026-08-26** (estrategia real definida — roles dinámicos, 2FA por fases, estándar de documentación/pruebas de seguridad exhaustivo — todavía sin código de aplicación)

---

## 1. Dónde estamos

Nada construido todavía — solo documentación real de estrategia, completa. Antes de escribir código hace falta un diseño técnico detallado (schema de roles dinámicos, endpoints reales de 2FA, estructura del monorepo) — ver `PLAN_DESARROLLO.md`.

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-08-26 | **Estrategia real definida — sigue sin código de aplicación, a propósito (modo diseño).** Confirmado con el dueño: este proyecto vive aparte del plan de 5 (Inari→Espiral→Dely Doggy→TecnoSolutions→OmniSkeleton) documentado en `Bridge/README.md` — complementa esa OmniSkeleton futura y además va al portafolio del dueño como pieza propia. Aunque el objetivo principal es que el dueño lea y entienda todo el código sin ayuda, el resultado debe ser cien por ciento funcional, al grado de servir de base real a un proyecto de cliente. Decisiones reales tomadas: roles **dinámicos** (no fijos, para generalizar mejor a un cliente desconocido); 2FA real **TOTP** (RFC 6238) desde el arranque; login "estilo Google" en 2 fases (Fase 1: UX de pasos separados, sin credenciales externas; Fase 2 futura: OAuth real, requiere que el dueño genere credenciales en Google Cloud); repositorio de git propio desde el primer commit (no compartido con Espiral/Dely Doggy). **2 requisitos nuevos que cambian cómo se construye todo lo que sigue**: (1) estándar de comentarios de código INVERTIDO contra Espiral/Dely Doggy — aquí TODA función/clase no trivial lleva TSDoc/JSDoc real (qué hace/espera/regresa), porque Compodoc los va a parsear para el portal de documentación real; (2) pruebas de seguridad exhaustivas documentadas aparte (`PRUEBAS_SEGURIDAD.md`, nuevo — cubre sistemáticamente el OWASP API Security Top 10, no solo el checklist ya heredado de hallazgos pasados), cada una con los pasos exactos para que el dueño la replique él mismo. También nuevos: `BIBLIOGRAFIA.md` (fuentes reales — RFCs de JWT/TOTP/OAuth, OWASP, docs oficiales del stack) y el plan de documentación autogenerada (`PLAN_DESARROLLO.md` §9 — misma arquitectura real de `delidogy_docs`/`delidogy_compodoc`: MkDocs + Swagger UI en vivo + Compodoc, se agrega al `docker-compose.yml` en cuanto exista backend real). Repositorio git local inicializado (`.gitignore` copiado/adaptado de Dely Doggy), sin remoto todavía. |
