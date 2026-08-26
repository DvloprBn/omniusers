# Checklist de seguridad pre-lanzamiento

> Destilado de la auditoría real de 9 rondas hecha sobre Espiral antes de su primer despliegue a producción (`../Espiral/ESTADO_PROYECTO.md` §62, 20 hallazgos reales encontrados y corregidos) más los hallazgos del propio despliegue a Vultr (`../Espiral/ESTADO_PROYECTO.md` §63). La idea es correr esta lista de forma **proactiva** contra el código de DeliDogy antes de su propio lanzamiento — no esperar a que alguien la rompa para descubrir el mismo patrón otra vez. Cada punto es una pregunta concreta que se responde revisando el código real, no en abstracto.

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

## XSS e inyección

- [ ] ¿Cualquier dato de texto libre (nombre de cliente, nota de staff, nombre de producto) que se interpola en HTML de correo o en JSON-LD del sitio pasa por un `escapeHtml()` real, o se interpola crudo?
- [ ] ¿`react-markdown` (o equivalente) se usa SIN plugin de HTML crudo habilitado, para que el escape sea automático?

## Subida de archivos

- [ ] ¿Todos los endpoints de subida de imagen tienen `limits.fileSize` en el interceptor (no solo una validación posterior, que deja bufferar el archivo completo en memoria primero — DoS de bajo esfuerzo)?
- [ ] ¿La validación de tipo de archivo revisa el CONTENIDO real (ej. `allowed_formats` de Cloudinary), no solo el `Content-Type` que el cliente puede falsificar? (un SVG real puede contener `<script>` aunque declare `image/png`)

## Sesión y autenticación

- [ ] ¿Detectar el reuso de un refresh token fuera de su ventana de gracia revoca TODAS las sesiones activas de esa cuenta, no solo el intento sospechoso?
- [ ] ¿Existe rate limiting dedicado en login/registro/reset de contraseña, por debajo del límite global de la API?
- [ ] ¿Las cookies de sesión tienen `httpOnly`, `secure` en producción, y `domain` explícito si frontend/backend viven en subdominios distintos?

## Reglas de negocio con dinero (descuentos/promociones)

- [ ] ¿Un descuento manual puede apilarse sobre una promoción ya activa sin que nadie lo confirme explícitamente como deseado?
- [ ] ¿La vigencia de un descuento/promoción se revalida en el momento de aplicarlo, no solo al mostrarlo?

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
