# Checklist de seguridad pre-lanzamiento

> Destilado de la auditoría real de 9 rondas hecha sobre Espiral antes de su primer despliegue a producción (`../Espiral/ESTADO_PROYECTO.md` §62, 20 hallazgos reales encontrados y corregidos) más los hallazgos del propio despliegue a Vultr (`../Espiral/ESTADO_PROYECTO.md` §63), y ampliado con la **2ª y 3ª ronda completas** de septiembre de 2026 (§66/§2.37 y §67/§2.38 — 5 y 8 vulnerabilidades reales más, todas reproducidas en vivo antes de tocar código). La idea es correr esta lista de forma **proactiva** contra el código de DeliDogy antes de su propio lanzamiento — no esperar a que alguien la rompa para descubrir el mismo patrón otra vez. Cada punto es una pregunta concreta que se responde revisando el código real, no en abstracto.

---

## Dinero y condiciones de carrera

- [ ] ¿Cualquier flujo que cobra/registra dinero (checkout, POS, webhook de pago, cierre de caja) usa una escritura condicionada (`updateMany` con condición + verificación de `count`, o un advisory lock) para que un doble clic o un webhook duplicado no cobre/registre dos veces?
- [ ] ¿Anular una venta/orden verifica que el corte de caja al que pertenece siga abierto? (anular después del cierre deja el corte desalineado en silencio)
- [ ] ¿Dos cierres de caja casi simultáneos (doble clic) pueden sobrescribirse uno al otro sin error?

## Control de acceso entre sucursales/entidades (IDOR)

- [ ] ¿Cada rol de "empleado" (staff/manager/equivalente) solo ve datos de SU sucursal/entidad asignada, o puede ver las de todas por accidente?
- [ ] ¿Cualquier acción de "aceptar/aprobar/asignar" verifica que quien la ejecuta es el destinatario real, no solo que está autenticado?
- [ ] ¿Los endpoints de direcciones/favoritos/galería/pedidos filtran por el `userId` del token, nunca solo por el ID que manda el cliente en la URL?

## Zona horaria

- [ ] ¿El contenedor corre en UTC? Si el negocio opera en una zona horaria fija (México, sin horario de verano desde 2022), cualquier cálculo de "hoy/esta semana/este mes/este año" con `new Date()` crudo está usando el calendario equivocado durante varias horas al día.
- [ ] ¿Se distingue entre un INSTANTE real (columna `timestamptz`, comparar con offset de zona horaria) y una FECHA pura (columna `date`, comparar en UTC sin offset)? Mezclar las dos desalinea la comparación exactamente por el offset de la zona horaria.
- [ ] **Concretamente: ¿hay algún `new Date(x.getFullYear(), x.getMonth(), x.getDate())` en el código?** Ese patrón construye la fecha en la zona horaria del proceso, que en un contenedor sin `TZ` es UTC. En un negocio que cierra de noche, **el turno de cierre de todos los días queda registrado con la fecha del día siguiente**. En Espiral eso alimentaba resúmenes de asistencia y sugerencias de bono, o sea nómina. Verificar además si `TZ` está definida en el `docker-compose` — si no lo está, la condición latente existe aunque hoy no haya ningún caso.
- [ ] Si aparece un caso ya guardado mal: ¿se decidió explícitamente si las filas históricas se corrigen o no? El arreglo del código es hacia adelante y **no** reescribe el pasado.

## XSS e inyección

- [ ] ¿Cualquier dato de texto libre (nombre de cliente, nota de staff, nombre de producto) que se interpola en HTML de correo o en JSON-LD del sitio pasa por un `escapeHtml()` real, o se interpola crudo?
- [ ] ¿`react-markdown` (o equivalente) se usa SIN plugin de HTML crudo habilitado, para que el escape sea automático?
- [ ] **¿Todo campo que guarda una URL está validado como URL, y acotado al host propio?** Un `@IsString()` a secas acepta cualquier cadena. Importa mucho **dónde se pinta**: en un `<img src>` el esquema `javascript:` NO ejecuta (ningún navegador actual lo hace) pero una URL externa sí se carga sola y entrega al atacante la IP, el navegador y el momento exacto en que la víctima abrió la pantalla — además de servir como GET a ciegas contra su red local; en un `href`, en cambio, `javascript:` **sí ejecuta** al hacer clic, o sea XSS almacenado. Si la URL legítima siempre la produce la propia app (subida a Cloudinary/S3), acotarla a ese host es la regla correcta: no existe un caso válido donde el cliente escriba otro dominio.
- [ ] ¿Se revisó quién puede escribir cada uno de esos campos? Uno alcanzable desde un endpoint **público sin autenticación** es un hallazgo de otra categoría que uno que solo escribe un admin — pero el segundo también hay que cerrarlo: convierte un panel comprometido en XSS contra todos los visitantes.

## Subida de archivos

- [ ] ¿Todos los endpoints de subida de imagen tienen `limits.fileSize` en el interceptor (no solo una validación posterior, que deja bufferar el archivo completo en memoria primero — DoS de bajo esfuerzo)?
- [ ] ¿La validación de tipo de archivo revisa el CONTENIDO real (ej. `allowed_formats` de Cloudinary), no solo el `Content-Type` que el cliente puede falsificar? (un SVG real puede contener `<script>` aunque declare `image/png`)

## Sesión y autenticación

- [ ] ¿Detectar el reuso de un refresh token fuera de su ventana de gracia revoca TODAS las sesiones activas de esa cuenta, no solo el intento sospechoso?
- [ ] ¿Existe rate limiting dedicado en login/registro/reset de contraseña, por debajo del límite global de la API?
- [ ] ¿Las cookies de sesión tienen `httpOnly`, `secure` en producción, y `domain` explícito si frontend/backend viven en subdominios distintos?
- [ ] **¿Desactivar, degradar o cambiarle la contraseña a una cuenta corta la sesión que YA tiene en la mano?** Revocar `refresh_tokens` solo impide *renovar*: si la estrategia de JWT es sin estado, el access token ya emitido sigue sirviendo hasta que expire (15 min es lo típico). Verificado en Espiral: un empleado desactivado seguía entrando al punto de venta con `200`. Hay dos formas de cerrarlo — releer la cuenta desde la base en cada request (simple, cuesta una consulta por petición; es lo que hace DeliDogy hoy) o una marca de invalidación en Redis comparada contra el `iat` del token (más barata, necesita Redis).
- [ ] **¿El login social (Google/Facebook/…) manda y verifica el parámetro `state`?** Sin él hay *login CSRF*: se puede forzar a una víctima a iniciar sesión en la cuenta del atacante y que todo lo que haga después quede registrado ahí. El `state` va en cookie httpOnly y se compara en el callback con comparación de tiempo constante. Ojo: un guard propio que solo resuelva otra cosa (p. ej. devolver 404 si el proveedor no está configurado) **no** agrega `state` — hay que agregarlo aparte.
- [ ] **Si hay 2FA por TOTP: ¿un código ya usado se rechaza?** Por defecto **no** — el mismo código de 6 dígitos sirve cuantas veces se intente durante su ventana de validez (~90 s). Lo exige el RFC 6238 §5.2. No hace falta columna ni migración: la librería devuelve el `timeStep` que validó; se guarda el último aceptado y se exige que el siguiente sea estrictamente mayor. Hay que aplicarlo en **todos** los puntos que validan TOTP (login, alta de 2FA, baja), no solo el login.
- [ ] **Si hay 2FA: ¿el token "puente" entre contraseña y segundo factor es de un solo uso?** Un JWT sin estado es reutilizable durante toda su vigencia. Se cierra con un `jti` dentro de la firma + una marca en Redis. Dos detalles de orden: comprobar "ya usado" **antes** de validar el código (para que un boleto quemado no gaste un código de recuperación) y consumirlo **después** de que el código resultó válido (un código mal escrito no debe quemar el boleto).
- [ ] **¿`forgot-password` tarda lo mismo exista o no la cuenta?** Responder `{ok:true}` idéntico no basta si el camino del usuario existente espera a escribir el token y a que el proveedor de correo conteste: medido en Espiral, **0.331 s vs 0.003 s**. Es un oráculo de enumeración *silencioso* — no crea nada, no manda nada, no deja rastro. Se cierra soltando el trabajo caro sin esperarlo (`void` + método que nunca propaga).
- [ ] ¿Se decidió **a conciencia** si `register` puede responder "ese correo ya está registrado"? Es una fuga de enumeración deliberada y muy común; ocultarla tiene un costo de experiencia real, así que es decisión de producto — pero hay que tomarla, no heredarla por descuido.

## Reglas de negocio con dinero (descuentos/promociones)

- [ ] ¿Un descuento manual puede apilarse sobre una promoción ya activa sin que nadie lo confirme explícitamente como deseado?
- [ ] ¿La vigencia de un descuento/promoción se revalida en el momento de aplicarlo, no solo al mostrarlo?

## Reglas de negocio que viven a la vez en la app y en la base

- [ ] **Si hay un constraint de Postgres (`EXCLUDE`, `CHECK`, índice único parcial) que codifica una regla de negocio, ¿la condición del constraint y el filtro equivalente en el código dicen EXACTAMENTE lo mismo?** Ese desfase es silencioso: la app cree que un hueco está libre y la base lo rechaza, o al revés. En Espiral el `EXCLUDE` excluía solo `'cancelada'` mientras la app filtraba distinto en cada punto → una cita **rechazada** dejaba el horario del artista muerto para siempre. La defensa es tener **una sola constante compartida** por todos los filtros de la app, y que la migración cite esa constante.
- [ ] **¿Alguna acción defensiva del sistema (rechazar, bloquear, marcar como spam) causa daño permanente que el propio usuario no pueda deshacer?** Es el patrón más traicionero: el mecanismo de defensa se vuelve el arma. Comprobar que existe un camino de recuperación por API para cada estado "negativo", no solo para el que se pensó primero.
- [ ] ¿Los estados posibles de cada máquina de estados están escritos en un solo lugar (schema + código), o hay listas paralelas que se pueden desincronizar?

## Infraestructura y despliegue (ver también `LECCIONES_ARQUITECTURA.md`)

- [ ] ¿`ALLOWED_ORIGINS`/CORS está explícito, nunca `*`, en producción?
- [ ] ¿Postgres/Redis están SIN puertos publicados al host — solo accesibles desde la red interna de Docker?
- [ ] ¿El único puerto público real es el del reverse proxy (Caddy/nginx), 80/443?
- [ ] ¿Todas las variables `NEXT_PUBLIC_*` llegan como `build.args`, no solo `environment:`? (ver lección #1 en `LECCIONES_ARQUITECTURA.md`)
- [ ] ¿Se comparó variable por variable el compose de desarrollo contra el de producción, no solo se asumió que "ya se copió todo"? (ver lección #2)
- [ ] ¿Ningún candado de `basic_auth`/vista-previa quedó puesto sobre un subdominio de API que se consume por `fetch()`? (ver lección #4)
- [ ] ¿Los secretos (JWT, API keys, contraseñas de servicio) tienen entropía real y viven fuera de git?
- [ ] ¿El algoritmo JWT está fijado explícitamente (ej. HS256), no negociado dinámicamente?

## CSV y exportación de datos

- [ ] ¿Cualquier generador de CSV escapa celdas que empiecen con `=`/`+`/`-`/`@` (CSV injection — Excel/Sheets pueden ejecutarlas como fórmula)?

---

*(Checklist vivo — agregar aquí cualquier categoría nueva que aparezca al auditar DeliDogy o TecnoSolutions, generalizada sin nombre de marca, para que la lista siga sirviendo al siguiente proyecto.)*

---

## Cómo verificar el control de acceso (método, no lista)

> Lección de método de la 3ª pasada sobre Espiral, y probablemente la más reutilizable de todas.

- [ ] **No inventariar los endpoints con un parser de código.** Se intentó y dio **falsos positivos masivos**: el parser buscaba los decoradores hacia atrás, pero el código ponía `@UseGuards`/`@Roles` *después* de `@Get`/`@Post`. Llegó a reportar "208 endpoints sin guard" — falso de principio a fin. Un inventario de seguridad equivocado es peor que no tenerlo: da confianza infundada en las dos direcciones.
- [ ] **Verificarlo contra la aplicación corriendo.** El método que sí funciona: sacar la tabla real de rutas del arranque del framework (Nest la imprime completa), golpear **cada una sin autenticación**, y clasificar por código de respuesta. Lo que no responde 401 es la lista corta que hay que revisar a mano, una por una. En Espiral: 352 rutas → 292 con guard → 60 públicas, todas revisadas y todas intencionales.
- [ ] **Ojo con el rate limit al hacer el barrido**: hay que subirlo temporalmente para poder recorrer todas las rutas, y **dejar constancia de revertirlo** — es exactamente el tipo de cambio temporal que se queda en producción por olvido.
- [ ] Si el proyecto **no** tiene un guard de autenticación global (`APP_GUARD`) + un decorador `@Public()` explícito, el modelo es *fail-open*: un endpoint que olvide su `@UseGuards` queda público sin que nada lo delate. Conviene invertirlo a *fail-closed* **antes** de que el número de módulos crezca.
