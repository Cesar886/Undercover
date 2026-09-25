# Moderación comunitaria sin identidad por IP

## Hallazgos críticos previos a la corrección (24/09/2026)

Se notificaron antes de modificar el código. Las líneas de esta tabla corresponden a la versión encontrada al iniciar la auditoría:

| Ubicación anterior | Uso encontrado | Consecuencia en campus |
| --- | --- | --- |
| `lib/communityModeration.ts:69–71` | Leía `X-Real-IP` o `X-Forwarded-For` y calculaba SHA-256(sal + IP) como `network_key`; rechazaba requests sin IP | El hash seguía representando a toda la universidad |
| `lib/communityModeration.ts:22–30,80–107` | UNIQUE por contenido/red, bloqueo transaccional por red, deduplicación por identidad **o** red, cuota 10/h por identidad **y** red | Una persona agotaba la cuota del campus; dos personas no podían reportar el mismo contenido |
| `app/api/posts/route.ts:90–92`, `app/api/posts/[id]/comments/route.ts:60–62` | Consultaban `getBanStatus(IP)` antes de publicar; guardaban `poster_ip` | Una sanción IP impedía publicar/comentar a usuarios distintos |
| `lib/ipban.ts`, `app/api/admin/ban/route.ts` | Lectura, aplicación y levantamiento de sanciones por IP | Bloqueos colectivos; retirados del flujo activo |
| `lib/auth.ts:20–33` | `getVoterKey` usaba `ip:<IP>` sin sesión; `getReporterId` devolvía `anon:<IP>` | Votos/reacciones y sus cuotas confundían usuarios; helper de reportes también inseguro aunque ya no lo llamaba el flujo comunitario |
| `app/api/image-admin/session/route.ts:10` | Cinco intentos/15 minutos por IP | Cuota compartida de acceso administrativo |
| `lib/anon.ts`, `middleware.ts`, `hooks/useAnonId.ts` | Identidad persistente en cookies `anon_token` y `anon_pub` | Contradecía el requisito de localStorage como única señal anónima |

También existía `hashVoterToken(ip, ...)` en `lib/hash.ts`, sin llamadas de producción; se renombró su entrada a identificador del navegador y se actualizaron los ejemplos de prueba. No hay una librería externa de rate limiting con una clave IP implícita: `lib/rateLimit.ts` exige una clave explícita.

## Identidad y cuotas vigentes

- La única señal persistente de **identidad anónima** es el UUID `deepum_owner_token` de localStorage, enviado como `X-Owner-Token`. Aunque el nombre histórico dice «token», es un identificador elegido por el cliente, no una credencial emitida/verificada que pruebe una persona.
- El servidor deriva `anon_id = SHA-256(UUID + sal del servidor)`. La sal evita publicar directamente el identificador de propiedad; no impide fabricar identidades nuevas. No se mezcla IP, red, cookie ni fingerprint.
- `ownerTokenHeaders()` inicializa el UUID cuando hace falta. Las lecturas del nombre anónimo usan `/api/identity`; ya no leen `anon_pub`. Middleware deja de emitir cookies anónimas y rechaza identificadores ausentes/inválidos en las operaciones que los requieren. No hay fallback a IP ni una identidad compartida por defecto.
- Reportes, sanciones, creación y edición anónimas usan ese mismo identificador. Votos/reacciones anónimos también. El repositorio contiene cuentas opcionales y sesiones administrativas preexistentes: sus cookies de autenticación se conservan, pero no identifican al reportante comunitario ni refuerzan su identidad anónima.
- **10 reportes aceptados por ventana móvil de 60 minutos por identificador**, sumando posts y comentarios. La cuota persiste en PostgreSQL. Los locks por identidad serializan peticiones concurrentes, incluso a contenidos diferentes.
- Un reporte por identificador y contenido; cinco identificadores distintos ocultan el contenido, aunque todos compartan IP. No se admiten reportes sobre contenido propio, ya oculto o eliminado ni sobre comentarios de posts ocultos.
- No existe cuota global ni por IP que frene la rotación de identificadores. Las cuotas de publicaciones, comentarios, votos, reacciones, categorías e intentos de login administrativo tampoco usan IP. Las cuotas en memoria mantienen su limitación preexistente: se reinician con el proceso y no se comparten entre instancias.
- `/api/admin/ban` queda retirado (410 tras autenticar al administrador). No se consultan `ip_bans` ni se guarda nueva `poster_ip` al publicar/comentar. Los registros históricos se conservan.
- Nginx aún reenvía cabeceras IP para infraestructura; ninguna lógica de identidad/cuota/sanción de la aplicación las consume. No hay `limit_req`/`limit_conn` en la configuración versionada revisada. No se afirma haber auditado configuraciones externas de CDN/proxy ni el despliegue activo.

## Persistencia y transición

`sql/migrations/011_reports_without_ip.sql` hace opcional `network_key` y retira su valor predeterminado sin borrar datos históricos. Los nuevos reportes guardan NULL, que no activa la restricción única antigua. La migración es idempotente y la inicialización aplica la misma compatibilidad si encuentra el esquema antiguo. El código nuevo no consulta ni genera identificadores de red.

El reporte, contador, ocultamiento e infracción se guardan en una transacción. El quinto reporte genera una sola infracción; los reportes pendientes no sancionan a nadie. Se mantiene la política: tercera infracción = una hora, quinta = 24 horas, décima y siguientes = siete días. Las sanciones sobreviven al borrado de contenido y expiran por fecha.

**Efecto de la transición:** los `anon_id` antiguos se derivaban de cookies, no del UUID de localStorage. No hay un vínculo fiable y universal que permita trasladar esas sanciones/autorías al identificador nuevo. Se conservan las filas históricas, los contadores y el contenido oculto, pero las sanciones antiguas no se transfieren automáticamente; el nuevo ID tampoco coincide con el autor antiguo para editar/eliminar mediante las rutas basadas en `anon_id`. El control separado de visibilidad basado en `owner_token` conserva su asociación si ese UUID sigue almacenado. No se reasignaron sanciones, autorías ni datos históricos por conjetura.

No se añadió revisión/reversión de ocultamientos comunitarios. La revisión manual de imágenes y el borrado semanal mantienen su comportamiento. Los eventos del feed siguen siendo locales al proceso.

## Pruebas reproducibles

- Jest: 22 suites, 190 pruebas aprobadas ([resultados](evidence/campus-jest-2026-09-24.json)). Incluye identificadores diferentes con **la misma IP y la misma cookie heredada**, estabilidad ante cambios de IP/cookie, ausencia de fallback y cuotas independientes de publicación/comentario/voto.
- TypeScript: `npx tsc --noEmit`, salida 0.
- Compilación de producción: `npm run build`, salida 0 en copia temporal sin archivos `.env` ([log](evidence/campus-build-2026-09-24.log)).
- PostgreSQL real **18.4 local y temporal**: 15 grupos aprobados. [Resultados](evidence/campus-postgres-2026-09-24.json) y [log](evidence/campus-postgres-2026-09-24.log).
- Quince identificadores distintos enviando simultáneamente requests desde `192.0.2.1`: **15 aceptados, cero 429**.
- Quince requests simultáneos de un mismo identificador sobre objetivos distintos: **10 aceptados, cinco 429**. Otro identificador en la misma IP puede reportar post y comentario; el identificador agotado no puede reportar ese comentario.
- Veinte requests con el mismo identificador y objetivo: **uno aceptado, 19 duplicados**. Cambiar IP no permite duplicarlo; otro identificador en la misma IP sí se acepta.
- Veinte rondas de cinco reportantes desde la misma IP: **100 reportes aceptados**, un ocultamiento/infracción por objetivo.
- Bloqueo IP heredado presente en la base: dos identidades del campus pueden publicar y comentar.
- Una identidad suspendida recibe 403; una nueva, desde la misma IP e incluso conservando la cookie anterior, puede publicar. Los cambios de localStorage evaden la sanción, como exige reconocer el modelo.
- Se verifican ausencia de cabeceras IP, migración idempotente con preservación de filas, vencimiento de cuota/sanción, rollback del quinto reporte, imágenes y borrado semanal. El error `audit rollback` del log se inyecta deliberadamente para probar atomicidad.

Ejecutor: `scripts/test-community-postgres.cjs`. Requiere una base **vacía y desechable** llamada `audit_reports_<hex>`, indicada por `AUDIT_DATABASE_URL`. Aplica migraciones y ejecuta las rutas reales con `NextRequest`; simula las cabeceras que envían navegadores con localStorage distinto. No es una prueba visual ni una medición de tráfico a través del proxy real.

La evidencia previa basada en cookies/IP es [histórica y está reemplazada](evidence/community-audit-before-campus.md).

## Riesgo residual — alto y fácil de explotar

Borrar localStorage, abrir otro perfil/navegador o enviar otro UUID válido crea una identidad nueva. Un script ni siquiera necesita un navegador: puede generar identificadores nuevos y enviarlos en la cabecera. El servidor no puede reconocer que todos pertenecen a la misma persona. La cuota de 10/h limita un identificador, **no una persona**, y no impone un techo efectivo al total de reportes de quien rota identificadores.

Con el umbral actual basta fabricar cinco identificadores para ocultar un contenido ajeno. Repetirlo en varios contenidos puede además provocar sanciones al autor. No se requieren IPs diferentes, cookies ni cuentas. Es fácil para alguien con conocimientos básicos de requests HTTP; el hash con sal no resuelve esta debilidad. Eliminar IP evita castigar al campus, pero deja explícitamente expuesta la debilidad de identidades múltiples que el diseño anónimo no puede resolver por sí solo. El limitador administrativo por identificador también puede evadirse mediante rotación.

No se implementaron CAPTCHA, fingerprinting, nuevos límites IP, login obligatorio ni otro control adicional. Sin una identidad verificable no se puede garantizar que varios identificadores correspondan a personas diferentes; incluso tener cuentas por sí solo no garantiza una persona por cuenta. Cualquier fricción adicional queda para decisión del usuario.

**No desplegado.** La revisión automática impidió crear una base/rol en un servidor remoto sin autorización explícita; se completaron las pruebas usando PostgreSQL local, sin modificar ese servidor.
