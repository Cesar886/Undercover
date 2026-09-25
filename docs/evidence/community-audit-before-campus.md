# Evidencia histórica, reemplazada por la corrección para campus

Este documento describe el estado anterior a la eliminación de identidad por IP y cookies. Sus conclusiones sobre identidad y cuotas NO describen el código actual. Véase [diseño vigente](../community-moderation.md).

# Moderación comunitaria

Posts y comentarios usan `lib/communityModeration.ts`. No necesitan una decisión humana:

- Cinco reportes de identidades anónimas y direcciones IP diferentes ocultan el contenido. Todos tienen el mismo peso; los votos y la antigüedad no alteran el umbral.
- Solo se admite un reporte por identidad o conexión para cada contenido. No se admite reportar contenido propio, eliminado u oculto, ni comentarios de posts ocultos.
- Máximo diez reportes aceptados en una hora, compartido entre posts y comentarios, por identidad o conexión. El límite se consulta en PostgreSQL y sobrevive reinicios.
- Los reportes pendientes no penalizan al denunciante ni al autor.
- Cada contenido que pasa a oculto suma una infracción al autor. Desde la tercera, suspensión de una hora; desde la quinta, 24 horas; desde la décima, siete días. Cada nueva infracción renueva la duración correspondiente, sin acortar una suspensión vigente.
- La suspensión impide publicar, comentar, editar y reportar. Permite leer y eliminar contenido propio. Expira automáticamente por fecha.
- Las imágenes nuevas permanecen privadas y pendientes en la cola de /imagenes-dnewjlfe99474ef8wu-admin. Solo la aprobación manual del admin permite publicarlas. La moderación comunitaria no sustituye esta aprobación.

## Persistencia y concurrencia

Las tablas `community_reports` y `community_sanctions` se crean de forma idempotente al primer uso, siguiendo el patrón de inicialización del proyecto. La cuenta de conexión necesita permisos de creación de tablas e índices.

El reporte, el contador, el ocultamiento y la infracción se guardan en una misma transacción. Bloqueos por identidad/conexión serializan las cuotas entre procesos; el bloqueo del contenido y las restricciones únicas evitan reportes e infracciones duplicados. Los eventos se emiten después del commit y quien reporta actualiza su interfaz con la respuesta HTTP.

Las infracciones sobreviven al borrado del contenido. Los reportes anteriores permanecen en `reports` como historial del sistema anterior y no generan sanciones retroactivas: no tienen la identidad verificable del nuevo flujo. Los contenidos ya ocultos permanecen ocultos. Las imágenes históricas pendientes en `image_reviews` no se publican retroactivamente.

## Límites de la identidad anónima

Una IP compartida (por ejemplo, Wi-Fi de campus) cuenta como una sola conexión. El proxy debe sobrescribir `X-Real-IP`; la configuración Nginx incluida lo hace. No debe exponerse el servidor Next directamente con cabeceras de IP controlables por el cliente.

La cookie identifica un navegador, no una persona. Borrar cookies puede evadir una sanción de identidad; combinar varias identidades y conexiones puede evadir las restricciones de reportes. No se afirma protección completa contra personas coordinadas o identidades múltiples.

## Auditoría del 24 de septiembre de 2026

Restaurada la aprobación manual de imágenes antes de iniciar esta auditoría. La imagen nueva entra con estado `pending`; `image_webp` permanece NULL en el post/comentario y no se emiten bytes en el evento público. La ruta `/imagenes-dnewjlfe99474ef8wu-admin` conserva la aprobación manual. No se desplegó ni se activó ninguna tarea programada.

### Evidencia reproducible

- Suite general: **21 suites, 184 pruebas aprobadas, cero fallos**. [Resultados por prueba](evidence/community-jest-2026-09-24.json).
- TypeScript: `npx tsc --noEmit`, salida 0.
- Compilación de producción: `npm run build`, salida 0, en una copia temporal sin archivos `.env`. [Log](evidence/community-build-2026-09-24.log).
- PostgreSQL **16.15 real**, no mocks: **11 grupos de integración aprobados**. [Resultados y tiempos](evidence/community-postgres-2026-09-24.json), [log completo](evidence/community-postgres-2026-09-24.log).
- Ejecutor: `scripts/test-community-postgres.cjs`. Requiere `AUDIT_DATABASE_URL` apuntando a una base VACÍA y desechable llamada `audit_reports_<hex>`. Aplica los esquemas y migraciones del repositorio y ejecuta las rutas reales. No usar una base con datos de usuarios.
- La conexión directa antigua agotaba el tiempo de espera. La auditoría usó una base y rol temporales separados en el PostgreSQL accesible por SSH. Para evitar latencia entre cada consulta se ejecutó una copia temporal compilada de los mismos módulos junto a PostgreSQL. Se eliminaron la base, el rol, los archivos de prueba y el túnel al terminar. No se reinició ni desplegó la aplicación.

El error `audit rollback` del log es **inyectado deliberadamente** mediante un trigger de la base de prueba: demuestra que una sanción fallida revierte el quinto reporte y el ocultamiento. El reintento registra exactamente una infracción.

### 1. Conteo y cuota

- Veinte peticiones simultáneas con la misma cookie/IP y distintos tokens de propiedad: **una aceptada y diecinueve 409**. Cambiar IP conservando la identidad o cambiar cookie conservando IP sigue dando 409. Esto reproduce las condiciones del servidor al recargar, abrir pestañas o limpiar localStorage; no es una prueba visual de navegador.
- La identidad usa la cookie HTTP-only `anon_token`, no localStorage. El `owner_token` de localStorage no identifica al reportante.
- La cuota es una ventana móvil de 60 minutos: **hasta 10 por identidad Y hasta 10 por IP**, sumando posts y comentarios. No es un límite global del post.
- Se corrigió durante la auditoría una suma excesiva de historiales: ahora identidad e IP se cuentan por separado. Se acepta una petición cuya identidad tiene 6 reportes y cuya nueva IP tiene 4 de otras identidades; no se consideran erróneamente 10 de un solo actor.
- Diez reportes de una identidad en IPs/objetivos diferentes pasan; el undécimo da 429; otra identidad y otra IP pueden reportar el mismo objetivo. Al envejecer los reportes más de 60 minutos vuelve a permitirse reportar.
- Quince identidades simultáneas en una IP y quince posts distintos: **diez aceptadas y cinco 429**.
- Veinte rondas de cinco reportantes distintos simultáneos: **100 reportes aceptados**, cinco filas por objetivo, un ocultamiento y una infracción por objetivo, sin pérdidas ni duplicados.

### 2. Umbral y reversión

Los reportes 1–4 mantienen `is_hidden=false`; el quinto devuelve `is_hidden=true` después del commit. La lectura pública devuelve 404. El contador, el reporte, el ocultamiento y la infracción son atómicos.

**Hallazgo: no hay una pantalla/endpoint de revisión y reversión de ocultamientos comunitarios ni una operación que revierta su infracción asociada.** El administrador de imágenes gestiona imágenes; no sustituye ese flujo. `/api/admin/ban` gestiona bloqueos IP y su listado de señalados excluye posts ya ocultos. No se añadió un mecanismo de reversión, conforme a la instrucción del usuario. Una intervención SQL manual no equivale a un flujo soportado y auditado.

La respuesta HTTP y las lecturas de PostgreSQL son consistentes tras el quinto reporte. Los eventos del feed usan un EventEmitter local al proceso: con varios procesos no se garantiza actualización instantánea de todas las pestañas conectadas a otros procesos; una nueva lectura sí respeta el ocultamiento. No se afirma una prueba visual de todas las sesiones abiertas.

### 3. Sanciones e identidad

Probadas once infracciones acumuladas: 1–2 sin suspensión; 3–4 una hora; 5–9 veinticuatro horas; desde 10 siete días. La undécima renueva siete días desde ese momento, sin sumar duraciones ni pasar a una suspensión permanente. Se conserva una fecha más larga si ya existía.

Las cinco rutas reales —publicar, comentar, editar post, editar comentario y reportar— devolvieron **403** durante la suspensión. Tras fijar su vencimiento en el pasado, sin borrar el contador, devolvieron **201, 201, 200, 200 y 200**. No hace falta cron para levantar el bloqueo: cada consulta compara con `NOW()`.

Limpiar solo localStorage conserva `anon_token`: no evita la sanción. **Borrar cookies, usar otro perfil/navegador o dispositivo sí permite obtener otra identidad y evadirla**; se comprobó que una identidad nueva puede publicar. Es una limitación inherente al modelo actual sin cuenta/verificación persistente entre dispositivos. Para reportes, cambiar solamente de cookie no elude la deduplicación por la misma IP. Una IP compartida aporta un reporte por contenido y comparte la cuota horaria; cinco personas en el mismo Wi-Fi no equivalen a cinco conexiones.

Los contadores no se reinician al expirar, borrar posts ni ejecutar el borrado semanal. No hay sanción retroactiva a partir de los reportes antiguos de `reports`.

### 4. Ocultamiento del autor y borrado semanal

El flujo comunitario usa la columna preexistente **`is_hidden`**. El control del creador usa **`owner_hidden`**, autorizado por `owner_token`/cabecera `X-Owner-Token` (el llamado owner_key). Son estados diferentes.

La ruta del creador solo actualiza filas con `is_hidden=false`. Con un post oculto por reportes, incluso el token de propiedad correcto recibe **403** al intentar desocultarlo; `is_hidden` sigue en true. La aprobación de una imagen tampoco resucitó un post oculto por la comunidad en la prueba.

En la base temporal se ejecutó `runQuema` con la hora simulada **lunes 28/09/2026, 05:00 America/Monterrey = 11:00 UTC**. Tanto el post con `owner_hidden=true` como el post con `is_hidden=true` fueron eliminados. No necesitan tratamiento distinto. El borrado eliminó 79 posts de prueba, 36 de ellos ocultos, y preservó los contadores de sanciones. Se verificó simulación sin borrado y repetición idempotente del mismo lunes. Los posts/hilos explícitamente `is_seed` están exceptuados por el diseño del borrado semanal.

**Estado del servidor comprobado por lectura:** temporizador `quemonesum-cleanup.timer` ausente/inactivo y `WEEKLY_CLEANUP_ENABLED` sin configurar en el archivo de entorno compartido. Por tanto, la inclusión de ambos tipos de ocultos está probada en el código, pero no se afirma que esta tarea nueva esté ejecutándose actualmente en producción. Su activación sigue pendiente; esta auditoría no la activa ni despliega.

### 5. Los siete fallos anteriores

Se reprodujeron antes de corregir las pruebas:

| Casos | Causa y corrección |
| --- | --- |
| Tres en posts | Mocks anteriores a propiedad, categorías y transacciones: fallaban antes de llegar al comportamiento que pretendían probar. Se actualizaron los colaboradores simulados manteniendo las comprobaciones de filtro, 429 y creación 201. |
| Uno en comentarios | Fixture anterior al token de propiedad y a la transacción. Actualizado; vuelve a comprobar creación y contenido. |
| Dos en votos | El voto repetido es idempotente (200), no 409; se ejecuta el callback y se verifica que no escribe de nuevo. El resultado simulado de la otra transacción necesitaba `{ votes, postLikeNotif }`. |
| Uno en CategoryPill | Esperaba naranja aunque el diseño actual usa mauve. Se corrigió la expectativa, no el diseño. |

Además, Jest recogía el script diagnóstico raíz `test.ts`, que no contiene pruebas. `testMatch` ahora recoge explícitamente todos los `*.test.ts/tsx` de `__tests__`. No se omitió ninguna de las pruebas fallidas. Los fallos de posts/comentarios tocaban rutas que también usan sanciones e imágenes; por ello se resolvieron y se añadieron/practicaron pruebas específicas, en lugar de declararlos irrelevantes.

### 6. Despliegue

**No desplegado.** Quedan documentados los límites de identidad, la ausencia de reversión administrativa, el alcance local de los eventos del feed y la tarea semanal pendiente de activación. No se añadió la función de reversión ni se cambió la política de aprobación manual de imágenes.
