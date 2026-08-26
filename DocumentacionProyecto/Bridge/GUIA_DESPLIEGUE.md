# Guía general — cómo subir cambios y correcciones a producción (Docker Compose + Vultr)

> Versión generalizada de `EspiralDocs/GUIA_SUBIR_CAMBIOS_A_PRODUCCION.md` — probada en Espiral, escrita aquí sin nombres de marca para que sirva tal cual en DeliDogy, TecnoSolutions y como base de lo que OmniSkeleton debería automatizar. Reemplaza los placeholders en mayúsculas (`IP_SERVIDOR`, `RUTA_PROYECTO`, `nombre_servicio`) por los valores reales de cada proyecto.

---

## 0. Dos máquinas, no confundirlas

Todo este proceso usa **dos terminales distintas** al mismo tiempo — la confusión más común es pegar un comando en la terminal equivocada.

| | Tu computadora (local) | Servidor de producción (Vultr) |
|---|---|---|
| Dónde vive el código fuente que editas con Claude | ✅ Aquí | — |
| Dónde corre el sitio real que ve la gente | — | ✅ Aquí |
| Cómo entras | Terminal normal, ya estás ahí | `ssh root@IP_SERVIDOR` |
| Para qué sirve | Editar y probar en desarrollo, y **mandar** archivos al servidor | Recibir archivos y **reconstruir** los contenedores |

Los comandos `scp` (subir archivos) siempre se corren **desde tu terminal local** — nunca desde dentro de la sesión SSH. Los comandos `docker compose` siempre se corren **desde dentro de la sesión SSH del servidor**.

---

## 1. Conectarte al servidor

Si se cerró tu sesión (apagaste la PC, cerraste la terminal) — el servidor sigue corriendo normal, son máquinas independientes.

```
ssh root@IP_SERVIDOR
```

Pide la contraseña de root (no se muestra en pantalla mientras escribes, es normal). Primera vez en esa terminal: puede preguntar `Are you sure you want to continue connecting?` — responde `yes`.

Ya adentro:

```
cd RUTA_PROYECTO   # ej. /root/delidogy
```

Ahí vive todo: `docker-compose.prod.yml`, `Caddyfile`, `.env`, y las carpetas del backend/frontend con el código ya subido.

---

## 2. ¿Qué tipo de cambio es? — esto decide qué comando corres

### Caso A — Cambió una variable de entorno normal (no `NEXT_PUBLIC_*`)

El backend (NestJS) lee estas variables **en tiempo real**, cada vez que arranca — no hace falta reconstruir ninguna imagen, solo que el contenedor vuelva a arrancar con el archivo actualizado.

```
# 1. Sube el archivo que cambió (normalmente docker-compose.prod.yml)
scp RUTA_LOCAL/docker-compose.prod.yml root@IP_SERVIDOR:RUTA_PROYECTO/docker-compose.prod.yml

# 2. En el servidor: recrea SOLO ese contenedor, sin reconstruir la imagen
docker compose -f docker-compose.prod.yml up -d --force-recreate nombre_servicio_backend
```

Tarda segundos.

### Caso B — Cambió código real (`.ts`, `.tsx`, backend o frontend)

El código se compila DENTRO de la imagen de Docker — hay que reconstruirla.

```
# 1. Sube cada archivo que cambió, a la misma ruta relativa dentro del servidor
scp RUTA_LOCAL/ruta/al/archivo.ts root@IP_SERVIDOR:RUTA_PROYECTO/ruta/al/archivo.ts

# 2. En el servidor: reconstruye la imagen del servicio que cambió
docker compose -f docker-compose.prod.yml up -d --build nombre_servicio
# o backend y frontend a la vez:
docker compose -f docker-compose.prod.yml up -d --build nombre_servicio_backend nombre_servicio_frontend
```

Tarda 1-3 minutos (recompila TypeScript/Next.js). Si el cambio tocó varios archivos, sube todos antes de correr el `--build`.

### Caso C — Cambió una variable `NEXT_PUBLIC_*` (API URL, Stripe, Analytics, etc.)

**El caso especial que más confunde la primera vez que se despliega un proyecto Next.js.** Ver `LECCIONES_ARQUITECTURA.md` en esta misma carpeta para el porqué completo — resumen: Next.js "quema" estas variables dentro del JavaScript del navegador durante la construcción de la imagen. No basta con `environment:` en el compose ni con recrear el contenedor (el Caso A no sirve aquí). Tienen que llegar como `build.args`.

Si se agrega una variable `NEXT_PUBLIC_*` nueva, necesita 3 cosas a la vez:
1. `ARG`/`ENV` en el `Dockerfile` del frontend.
2. La entrada correspondiente en `build: args:` de `docker-compose.prod.yml`.
3. El valor real en `.env`.

Si solo cambia el VALOR de una variable que ya existe en los 3 lugares, es el mismo comando que el Caso B.

### Caso D — Cambió el modelo de datos (Prisma, `schema.prisma`)

El más delicado — toca la base de datos real con clientes/pedidos reales adentro. Nunca hacerlo sin que Claude confirme el paso exacto primero (puede requerir una migración escrita a mano, no automática). El comando de arranque del backend normalmente ya corre `prisma migrate deploy` solo, así que casi siempre basta con reconstruir el backend (Caso B) — pero confirmar antes de asumirlo, y **siempre** verificar contra `pg_constraint`/`information_schema` antes de asumir que algo "no existe todavía" solo por un comentario `TODO` en el código (ver `LECCIONES_ARQUITECTURA.md`).

---

## 3. Comandos que se usan seguido

**Subir un archivo suelto:**
```
scp RUTA_LOCAL root@IP_SERVIDOR:RUTA_EN_EL_SERVIDOR
```

**Reconstruir un servicio** (código nuevo):
```
docker compose -f docker-compose.prod.yml up -d --build NOMBRE_SERVICIO
```

**Recrear un servicio sin reconstruir** (solo variable de entorno normal):
```
docker compose -f docker-compose.prod.yml up -d --force-recreate NOMBRE_SERVICIO
```

---

## 4. Cómo confirmar que sí funcionó

Nunca asumir que un `up -d` exitoso significa que el cambio real funciona — el comando puede terminar bien y el sitio seguir roto.

```
docker compose -f docker-compose.prod.yml ps                    # los 5 contenedores arriba y sanos
docker compose -f docker-compose.prod.yml logs -f nombre_servicio  # logs en vivo si algo no arranca
```

**La prueba real**: siempre abrir el sitio real en el navegador y probar justo lo que se corrigió — un contenedor "healthy" no garantiza que la corrección específica ya se vea reflejada.

---

## 5. Reglas de seguridad, sin excepción

- Nunca subir el archivo `.env` a ningún lado público — tiene contraseñas y llaves reales.
- Nunca correr `docker compose down -v` (borra los volúmenes = borra la base de datos real) sin un respaldo confirmado.
- Antes de cualquier cambio directo a la base de datos (`psql`), pedir el `SELECT` de verificación primero — nunca un `DELETE`/`UPDATE` a ciegas contra producción.
- Antes de un `ALTER TABLE ... ADD CONSTRAINT`, verificar con un `SELECT count(*)` que ninguna fila existente lo violaría — un `CHECK` que falla al aplicarse puede dejar la migración a medias.
