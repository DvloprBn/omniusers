# Pruebas de Seguridad — Omniskeleton (Login)

> Complementa (no reemplaza) `DocumentacionProyecto/Bridge/CHECKLIST_SEGURIDAD_PRELANZAMIENTO.md`. Ese checklist es una lista de preguntas destiladas de hallazgos reales que ya fallaron antes en otro proyecto — este documento es más exhaustivo: cubre sistemáticamente el **OWASP API Security Top 10** completo contra cada endpoint real que se construya, para no depender solo de lo que ya se conoce que puede fallar.
>
> **Formato de cada prueba** (para que el dueño la pueda replicar él mismo, no solo leer que "ya se probó"):
> 1. **Qué vulnerabilidad prueba** y por qué importa en este caso concreto (no una definición genérica de OWASP).
> 2. **Cómo reproducirla a mano** — comando/pasos exactos (`curl`, Postgres, DevTools, lo que aplique).
> 3. **Qué cuenta como "pasa"** — el resultado esperado exacto, no ambiguo.
> 4. **Resultado real** — la fecha en que se corrió y qué pasó de verdad, nunca "debería funcionar".

Arranca vacío a propósito — sin endpoints todavía no hay nada real que probar. Se llena en paralelo a cada pieza que se construya (nunca al final de golpe, para que cada prueba se corra contra el código real que la motivó, no de memoria después).

## OWASP API Security Top 10 (2023) — mapa de lo que cubriremos, conforme exista código real

| # | Categoría | Aplica a este proyecto | Estado |
|---|---|---|---|
| API1 | Broken Object Level Authorization (IDOR) | Sí — cualquier endpoint que devuelva datos de un usuario por id | Pendiente |
| API2 | Broken Authentication | Sí — el núcleo real del proyecto (login, JWT, refresh, 2FA) | Pendiente |
| API3 | Broken Object Property Level Authorization | Sí — qué campos puede leer/escribir cada rol | Pendiente |
| API4 | Unrestricted Resource Consumption | Sí — rate limiting en login/registro/reset/2FA | Pendiente |
| API5 | Broken Function Level Authorization | Sí — `RolesGuard` en cada endpoint de administración | Pendiente |
| API6 | Unrestricted Access to Sensitive Business Flows | Parcial — sin flujo de negocio real, pero aplica a registro masivo/fuerza bruta | Pendiente |
| API7 | Server Side Request Forgery (SSRF) | Solo si Fase 2 (OAuth real de Google) hace llamadas salientes | Pendiente |
| API8 | Security Misconfiguration | Sí — CORS, cookies, cabeceras, puertos expuestos, secretos | Pendiente |
| API9 | Improper Inventory Management | Sí — versión de API, endpoints de debug que no deberían quedar expuestos | Pendiente |
| API10 | Unsafe Consumption of APIs | Solo si Fase 2 (Google OAuth) consume una API externa | Pendiente |

## Pruebas específicas de este proyecto (más allá del Top 10 genérico)

- 2FA: ¿se puede saltar el segundo factor manipulando el request directo a la API, sin pasar por la UI?
- 2FA: ¿el código TOTP es de un solo uso real (no se puede reenviar el mismo código dos veces)?
- Roles dinámicos: ¿un rol recién creado con permisos vacíos de verdad no puede hacer nada, o hereda algo por accidente?
- Sesión: ¿cerrar sesión revoca de verdad el refresh token en el servidor, o solo borra la cookie del navegador?
