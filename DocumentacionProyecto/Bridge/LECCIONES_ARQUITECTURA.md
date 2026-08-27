# Lecciones de arquitectura — reutilizables entre proyectos

> Generalizadas a partir de hallazgos reales en Espiral (ver `../Espiral/DOCUMENTO_VIVO_ARQUITECTURA.md` para la versión completa con nombres de marca y contexto original). Cada entrada aquí es una regla accionable, no una anécdota — se agregan nuevas conforme DeliDogy (y después TecnoSolutions) encuentren cosas que valga la pena generalizar. Esto es exactamente el tipo de contenido que después alimenta el diseño de OmniSkeleton.

---

## 1. Variables `NEXT_PUBLIC_*` de Next.js: tiempo de BUILD, no tiempo de arranque del contenedor

**La regla**: cualquier variable de entorno con el prefijo `NEXT_PUBLIC_` (las que el navegador necesita) tiene que llegar como `ARG`/`ENV` en el `Dockerfile` del frontend + `build: args:` en `docker-compose.prod.yml`. Nunca basta con `environment:` a secas — eso solo afecta al contenedor ya arrancado, mucho después de que el JavaScript del navegador ya se compiló con esa variable vacía.

**Por qué pasa**: Docker construye una imagen en pasos que corren una sola vez, por adelantado (`docker build`) — el resultado queda "congelado". Arrancar un contenedor después (`docker run`/`docker compose up`) no vuelve a ejecutar esos pasos. `next build` (que sustituye `NEXT_PUBLIC_*` por su valor literal) corre DENTRO del build de la imagen — antes de que el contenedor final exista siquiera.

**Síntoma real si se comete el error**: el sitio funciona perfecto contra `localhost` en desarrollo, y en el primer despliegue a un dominio real, las peticiones del navegador van a una URL de respaldo pensada solo para pruebas locales (ej. `:3010` en vez de la API real) — sin ningún error explícito, solo "se queda pensando".

**Variables que SÍ pueden vivir solo en `environment:`**: cualquiera SIN el prefijo `NEXT_PUBLIC_` (las que solo lee el servidor de Next.js/Node en tiempo real, ej. una URL interna usada solo en Server Components).

---

## 2. Diferenciar `docker-compose.yml` (dev) de `docker-compose.prod.yml` no es una copia automática

**La regla**: al escribir el compose de producción a partir del de desarrollo, revisar variable por variable el bloque `environment:` de cada servicio — es fácil que una quede fuera sin que ningún error de compilación lo detecte, porque el código en sí es correcto; el hueco vive en la configuración, no en la lógica.

**Síntoma real**: `FRONTEND_URL` (usada para armar links reales en correos transaccionales — verificación de cuenta, restablecer contraseña — y en la redirección tras login social) existía en el compose de desarrollo pero nunca se copió al de producción. Los correos reales salían con links a `localhost`, en silencio, sin ningún error visible hasta que alguien probaba el flujo completo.

---

## 3. Un comentario `TODO` en el código puede estar desactualizado — verificar el estado real antes de actuar

**La regla**: antes de dar por "pendiente" algo basado en un comentario del código (`TODO(migración)`, etc.), verificar contra el estado real del sistema — en el caso de una restricción de base de datos, contra `pg_constraint`/`information_schema` directo, no solo contra lo que dice `schema.prisma`.

**Por qué importa**: un comentario se escribe una vez y puede quedar sin borrar después de que el trabajo ya se hizo (por otro camino, o en otro momento). Confiar ciegamente en él puede llevar a repetir trabajo — o peor, crear una restricción/columna/endpoint duplicado.

**Cómo se descubrió**: se intentó "cerrar" 3 `TODO(migración)` de restricciones `CHECK` que en teoría nunca se habían agregado — un `INSERT` de prueba diseñado para violar la regla reveló, en el mensaje de error, el nombre de una restricción YA EXISTENTE (distinta a la que se acababa de crear) — las 3 ya llevaban semanas ahí, agregadas en migraciones anteriores, el comentario simplemente nunca se actualizó.

---

## 4. Candados de "vista previa" (basic auth) sobre una API que se consume por `fetch()` la rompen en silencio

**La regla**: un candado `basic_auth` (usuario/contraseña a nivel de servidor web) solo dispara el diálogo nativo del navegador en una **navegación completa de página** — nunca en una petición `fetch()`/XHR hecha por JavaScript (ej. un login que llama directo a un subdominio de API). Si se necesita ocultar un sitio en construcción, el candado va en el dominio principal (el que sí se navega); no en subdominios que solo reciben tráfico de API.

**Síntoma real**: login que "se queda pensando" para siempre, sin ningún error visible en la UI — la petición se rechaza con 401 en silencio, sin que el navegador muestre ningún diálogo que alertara al usuario.

---

## 5. Servidor propio por proyecto cuando el tamaño es comparable

**La regla** (decisión de negocio, no puramente técnica, pero con consecuencias de arquitectura reales): un VPS ya sirviendo un e-commerce completo con tráfico real no tiene margen cómodo para absorber un SEGUNDO negocio del mismo peso sin arriesgar que ambos se sientan lentos en horas pico, ni aislamiento real de incidentes (un bug/ataque en un proyecto no debería poder afectar al otro). Compartir servidor solo tiene sentido cuando el segundo proyecto es genuinamente ligero comparado con el primero.

---

## 6. `Cross-Origin-Embedder-Policy` casi siempre rompe imágenes de un CDN de terceros (Cloudinary, etc.) — probar en vivo antes de agregarlo, nunca solo por completar el checklist de un escáner

**La regla**: `Strict-Transport-Security`, `Cross-Origin-Opener-Policy` (`same-origin`) y `Cross-Origin-Resource-Policy` (`same-origin`) son casi siempre seguros de agregar sin ninguna prueba especial — pero `Cross-Origin-Embedder-Policy: require-corp` NO. Antes de agregarlo, hay que confirmar en vivo (nunca solo leyendo documentación) que CADA recurso cross-origin que el sitio carga (imágenes de un CDN, scripts de terceros, fuentes) manda su propia cabecera `Cross-Origin-Resource-Policy` — si uno solo no la manda, ese recurso se bloquea por completo en el navegador, sin ningún aviso visible más que la imagen rota/el recurso faltante.

**Por qué pasa**: `require-corp` exige que TODO recurso cross-origin opte explícitamente a ser cargado (vía CORS real con la petición marcada `crossorigin`, o vía la cabecera `Cross-Origin-Resource-Policy` del recurso). Un CDN de imágenes típico (Cloudinary, S3 con `Access-Control-Allow-Origin: *`, etc.) suele mandar cabeceras CORS normales, pero NO necesariamente `Cross-Origin-Resource-Policy` — y una petición hecha con `<img src="...">` simple (sin el atributo `crossorigin`) ni siquiera intenta CORS, así que el `Access-Control-Allow-Origin` del CDN no sirve de nada en ese caso. Ambas condiciones (falta la cabecera Y la petición no es CORS) bastan para que el navegador bloquee el recurso.

**Síntoma real, medido con Playwright real contra un catálogo real (119 imágenes)**: con `Cross-Origin-Embedder-Policy: require-corp` puesto, 118 de 119 imágenes de producto se rompieron al instante (`net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep`), y una petición de analítica (Google Analytics) también se vio afectada en la misma corrida — sin este header, 0 de 119 rotas, comportamiento idéntico al de siempre.

**Costo real de "arreglarlo bien" vs. beneficio real**: forzar CORS real en cada `<img>` (agregar `crossorigin="anonymous"` a cada uso, y confirmar que el CDN responde con `Access-Control-Allow-Origin` compatible con eso) es un cambio que toca potencialmente decenas de lugares en el frontend — y el beneficio real de COEP (habilitar aislamiento cross-origin para APIs sensibles como `SharedArrayBuffer`/temporizadores de alta precisión) casi nunca aplica a un sitio de comercio/contenido normal. Un escáner de seguridad (securityheaders.com y similares) lista COEP como "Upcoming Header" — no resta puntos del grado principal — así que no hay urgencia real de agregarlo si el costo no se justifica. `Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy`, en cambio, no dependen de terceros (CORP controla quién puede cargar TUS PROPIOS recursos; COOP solo afecta relaciones `window.opener`/popup) — mucho más seguros de agregar sin esta misma investigación, aunque conviene confirmar igual que el sitio no use ningún flujo real de `window.open`/OAuth por popup antes de fijar COOP en `same-origin`.

*(Descubierta en Espiral 2026-08-27, generalizada aquí el mismo día — ver `../Espiral/DOCUMENTO_VIVO_ARQUITECTURA.md` §2.29 para el caso real completo con nombres de dominio/cifras.)*
