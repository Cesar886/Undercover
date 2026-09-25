# Limpieza semanal: alcance documentado antes de implementar

Se aplica la autorización del pedido: posts y comentarios visibles y hidden se
borran permanentemente los lunes a las 05:00 en America/Monterrey.

Inventario verificado en sql/schema.sql, sql/migrations, sql/notifications.sql y lib:

| Tablas | Política |
| --- | --- |
| posts, comments | Contenido de usuarios; borrar con respaldo previo. |
| image_reviews; posts.image_webp, comments.image_webp | Imágenes; conservar bytes permanentemente en image_reviews, incluso al eliminar el origen. |
| votes, comment_votes, post_reactions, comment_reactions | Dependencias del contenido eliminado; borrar por cascada. |
| post_polls, post_poll_options, post_poll_votes | Encuestas dependientes; borrar por cascada. |
| reports, notifications | Borrar únicamente referencias al contenido eliminado. |
| categories | Conservar todas, incluidas las semilla is_system=true: general, quemones, infieles, confesiones, stickers. |
| users, ip_bans, community_reports, community_sanctions | Conservar cuentas y datos de seguridad/moderación. |
| image_admin_sessions, deploy_migrations | Conservar sesiones y metadatos de despliegue. |

No hay posts/comentarios semilla en los scripts de esquema revisados. Se añade
is_seed para proteger excepciones explícitas: los posts marcados y todos sus
comentarios se conservan; marcar un comentario protege también su hilo completo.
Antes de activar, cualquier semilla agregada fuera del repositorio debe marcarse.
No se infiere que un post sea semilla por categoría, autor o antigüedad.

Se conserva la ruta del administrador, sus credenciales y la revisión sin caducidad.
La prohibición absoluta de borrar imágenes requiere sustituir la operación de
borrado de imágenes por ocultamiento y desacoplar su existencia del post/comentario.

## Funcionamiento y respaldo

Migración: `010_weekly_cleanup.sql`. Desacopla las imágenes de las cascadas,
copia las imágenes antiguas al archivo privado y protege los bytes contra
UPDATE, DELETE y TRUNCATE. Conserva los IDs originales para identificar su origen.
La tarea elimina las publicaciones no semilla y sus dependencias. Las imágenes
permanecen en `image_reviews` con `public_visible=false`, conservando su estado
de moderación. Aprobar una imagen huérfana actualiza su estado privado sin recrear
la publicación. Los hilos semilla quedan intactos, incluidas sus imágenes.

Antes del DELETE se inserta una instantánea JSONB fechada en
`weekly_cleanup_backups`, con todas las filas que se eliminarán de cada tabla.
Respaldo y borrado se confirman en una misma transacción: si falla cualquiera,
ambos se revierten y ningún contenido se pierde. Las tablas se bloquean durante
la operación para impedir cambios entre instantánea y borrado. Este respaldo
protege frente a errores de limpieza; no sustituye los respaldos externos de
PostgreSQL ante pérdida del servidor.

Los respaldos caducan a los 21 días y se purgan en la siguiente ejecución exitosa:
retención habitual de 3–4 semanas, evitando que pequeñas variaciones del horario
alarguen una retención de 28 días hasta la quinta semana. Si falla la tarea, se
conservan por seguridad hasta que vuelva a completarse. Los registros de auditoría
no caducan; los errores se registran en `weekly_cleanup_runs` fuera de la
transacción fallida y también en los logs de aplicación. Simulaciones y duplicados
se registran en stdout, sin modificar la base en simulación.

Para recuperar contenido, seleccionar el respaldo por `id`/`created_at`, extraer
`payload` y restaurar primero en una base aislada con el mismo esquema. Cada clave
contiene filas completas (compatibles con `jsonb_populate_recordset`). Restaurar
posts, comentarios padres antes que respuestas, encuestas/opciones, votos,
reacciones, reportes y notificaciones; verificar conflictos de IDs antes de copiar
hacia producción. Las imágenes originales siguen en el archivo privado. No hay
restauración automática ni endpoint público para consultar respaldos.

## Activación automática con deploy.sh

Ejecutar desde la PC:

```bash
./deploy.sh --check  # Comprueba acceso, DB, PM2 y systemd; no modifica el servidor.
./deploy.sh          # Publica frontend/backend, migra la DB y activa el programador.
```

El despliegue incluye código local (también cambios sin commit), compilación .next,
archivos públicos, rutas API/backend, dependencias y todas las migraciones SQL.
Conserva la base remota y sus datos, genera un pg_dump antes de migrar y aplica solo
migraciones pendientes. No copia la base local ni sus credenciales sobre el servidor.

Durante el cambio de versión se desactiva el timer. La nueva aplicación arranca
con `WEEKLY_CLEANUP_ENABLED=true` en su configuración PM2. Se conserva CRON_SECRET;
si falta, se genera en el archivo de entorno remoto con permisos 0600, sin mostrarlo.
Antes de habilitar el timer, el despliegue ejecuta una simulación autenticada y
comprueba que termine correctamente. Después instala las unidades de systemd,
valida la expresión horaria y habilita el timer de forma persistente entre reinicios.
Si falla la simulación o la activación, restaura la versión previa con la limpieza
desactivada. Nunca restaura automáticamente una base antigua ni ejecuta un borrado
como parte de la prueba del deploy. Si el despliegue coincide con un lunes a las
05:00, el timer puede ejecutar la tarea programada una vez activado.

Las semillas agregadas manualmente fuera del repositorio deben marcarse con
`is_seed` antes de la primera ejecución semanal. Las categorías semilla existentes
se conservan automáticamente.

Para inspeccionar o repetir una simulación desde `/srv/quemonesum/current`:

```bash
node scripts/weekly-cleanup-request.cjs --dry-run
systemctl list-timers quemonesum-cleanup.timer
journalctl -u quemonesum-cleanup.service
```

La API `POST /api/cron/quema?dryRun=true` requiere `Authorization: Bearer <CRON_SECRET>`.
Omitir dryRun equivale a simulación: no crea respaldos, borra contenido, actualiza
imágenes ni emite eventos al feed. El servicio usa localhost:3107 y lee el secreto
en memoria, sin exponerlo en argumentos del proceso.

`OnCalendar=Mon *-*-* 05:00:00 America/Monterrey` usa una zona IANA explícita;
no depende de la zona del servidor. Sintaxis verificada con `systemd-analyze` y
la [documentación de systemd](https://github.com/systemd/systemd/blob/main/man/systemd.time.xml).
`Persistent=false` evita ejecutar limpiezas atrasadas tras reiniciar. La API exige
lunes a las 05:00 locales y una ejecución exitosa máxima por fecha. Un bloqueo
transaccional serializa llamadas concurrentes; un fallo admite reintento durante
ese minuto. Las peticiones fuera de horario se omiten.

Como alternativa para Vercel, vercel.json invoca cada hora y la validación IANA
decide cuándo ejecutar; requiere configurar WEEKLY_CLEANUP_ENABLED=true en ese
entorno. En este servidor deploy.sh configura únicamente el timer de systemd.

## Verificación reproducible sin datos reales

```bash
npm install --prefix /tmp/quemados-cleanup-test --no-package-lock @electric-sql/pglite
PGLITE_MODULE=/tmp/quemados-cleanup-test/node_modules/@electric-sql/pglite node scripts/test-weekly-cleanup.cjs
node scripts/test-deploy.cjs
npx tsc --noEmit
npm test -- --runInBand
```

La integración usa PostgreSQL embebido en memoria: aplica el esquema y todas las
migraciones, crea datos ficticios y verifica simulación, cascadas, preservación de
semillas/bytes, revisión de imágenes huérfanas, idempotencia, fallos de respaldo,
rollback, retención y horario histórico con y sin horario de verano. No carga
.env ni abre conexiones a la base del proyecto.
