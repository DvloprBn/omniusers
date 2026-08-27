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

---

## 7. Un elemento "oculto" (menú/dropdown/panel) sigue siendo parte del DOM — sus imágenes se descargan igual, aunque nunca se vean

**La regla**: ocultar un panel con `opacity-0`/`pointer-events-none` (para animarlo con transición, o para no desmontarlo y remontarlo en cada apertura) es distinto de quitarlo del DOM. Cualquier `<img>` que viva ahí adentro se descarga en cuanto el HTML se parsea, exactamente igual que si estuviera visible — a menos que se le ponga `loading="lazy"` explícito (o el componente de imagen del framework lo traiga por default, ej. `next/image` sin `priority`).

**Por qué importa más de lo que parece**: un panel tipo mega-menú/dropdown con vista previa de contenido (productos, artículos, lo que sea) puede fácilmente sumar docenas de imágenes — si cada una pesa cientos de KB porque además se está pidiendo el archivo ORIGINAL en vez de un tamaño real para la miniatura, el total compite por ancho de banda justo con lo que sí importa en el primer pintado (la imagen principal del hero, el LCP real de la página) — un usuario que jamás abre ese menú paga el costo completo igual.

**Síntoma real, medido con Lighthouse real**: un mega-menú de categorías con vista previa de 3 productos cada una (hasta ~48 imágenes en total) estaba montado siempre en el DOM de la página de inicio, mostrando cada miniatura en un contenedor de 40×40px pero descargando el archivo original de un CDN (300-600KB, hasta 2000px de ancho) sin `loading="lazy"` — medido como una causa real y significativa de un LCP de 5 segundos en móvil.

**La corrección real, 2 partes, ninguna opcional por sí sola**: (1) usar el componente de imagen optimizada del framework (`next/image` o equivalente) en vez de un `<img>` simple, con el tamaño REAL que se va a mostrar (no el original) — pide al servidor de optimización de imágenes un archivo del tamaño correcto, no que el navegador baje el original completo y lo encoja con CSS; (2) confiar en la carga perezosa por default de ese componente (o agregar `loading="lazy"` a mano si se sigue usando `<img>`) — un panel que nunca se abre no debería gastar ni un byte de red.

---

## 8. El fallback de un `Suspense`/`loading.tsx` que no se parece al alto real de la página ES el layout shift completo del sitio

**La regla**: cuando un framework envuelve una página en un límite de carga (Next.js App Router con `loading.tsx`, o cualquier equivalente de Suspense/skeleton en otros frameworks), el navegador pinta primero ese fallback y después reemplaza TODO el contenido de golpe cuando los datos reales terminan de resolver. Si el fallback es mucho más corto que la página real (ej. un spinner centrado de unos cientos de píxeles, contra una página real de miles de píxeles), ese reemplazo ES un layout shift — y si la página tiene contenido debajo del spinner (footer, secciones), se ve empujado de golpe en un solo instante.

**Por qué se pasa por alto tan fácil**: el spinner en sí "se ve bien" — nadie prueba manualmente "¿se sintió como que saltó algo?" en cada carga, y en desarrollo local (datos ya en caché/red rápida) el fallback casi no llega a verse, así que el problema es invisible hasta medirlo con datos reales de campo o con throttling de red real.

**Síntoma real, medido en vivo con el `PerformanceObserver` nativo del navegador contra un sitio real en producción**: una página con `loading.tsx` = solo un spinner (unos cientos de píxeles de alto real) contra una página final de ~8,700px reales — al insertarse el contenido real a los ~3 segundos, un único evento de layout shift valió 0.4228 — **el CLS completo medido del sitio entero** era, literalmente, este reemplazo.

**3 caminos reales, con trade-offs distintos, nunca "solo quitar el spinner" sin decidir cuál se acepta**:
1. **Esqueleto que reserva el alto real** (recomendado cuando la página tiene secciones bien definidas): medir con el propio navegador (Playwright, DevTools) el alto real de cada sección de la página final, y construir el fallback con bloques de ese mismo alto (`animate-pulse` u otro indicador visual, el contenido interno no importa, solo el ESPACIO que reserva). Mantiene la carga rápida percibida sin el salto.
2. **Quitar el límite de Suspense/loading.tsx** y esperar a que TODOS los datos estén listos antes de mandar cualquier HTML: cero salto garantizado, pero peor tiempo hasta el primer pintado (pantalla en blanco más tiempo) — trade-off real, no una mejora gratis.
3. **Partir la página en varios límites de Suspense más finos**: lo esencial (nav, hero) se manda al instante; secciones menos críticas (reseñas, contenido relacionado, promociones) se cargan aparte, cada una con su propio espacio reservado — más quirúrgico, más reestructuración real de la página.

*(Ambas lecciones #7 y #8 descubiertas en Espiral 2026-08-27, investigando un reporte real de PageSpeed Insights — ver `../Espiral/DOCUMENTO_VIVO_ARQUITECTURA.md` §2.30 para el caso completo con cifras/rutas reales.)*
