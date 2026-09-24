# Test deployment — quemonesum.site

## Desplegar desde la PC

Desde la raíz del proyecto:

```bash
./deploy.sh --check  # Solo comprobar acceso y requisitos
./deploy.sh          # Compilar y publicar los cambios actuales
```

El script incluye los cambios locales aunque aún no tengan commit. Compila una
copia temporal, instala dependencias de producción en una versión nueva y
reinicia únicamente `quemonesum-test` usando el PM2 global del servidor. No
reinicia PM2 completo ni los procesos de la otra página.

Cada despliegue crea un respaldo PostgreSQL en `/srv/quemonesum/backups/`.
Conserva las credenciales remotas en `/srv/quemonesum/shared/.env.production`;
los archivos `.env` de la PC no se suben. No ejecuta el bootstrap, no restaura
respaldos y no reemplaza la base de datos.

Las migraciones nuevas deben añadirse a `sql/migrations/` con un número posterior
al último aplicado. La tabla `deploy_migrations` registra sus checksums para
ejecutarlas una sola vez; modificar una migración ya aplicada aborta el despliegue.
El primer uso registra las migraciones que ya estaban en el servidor sin
repetirlas. Las nuevas se aplican en una transacción y se rechazan sentencias
destructivas comunes. Escribe siempre migraciones aditivas compatibles con la
versión anterior: no borres tablas, columnas ni datos existentes.

Las versiones quedan en `/srv/quemonesum/releases/`; `current` apunta a la activa.
Si la nueva aplicación no arranca o falla la comprobación HTTP, el script intenta
volver al código anterior. La base no se retrocede automáticamente, para no
perder datos nuevos. Se conservan versiones y respaldos; revisa periódicamente
el espacio disponible en el servidor.

Deployed on 2026-09-24 to 164.90.129.213 alongside the existing marketplace.

- Versión activa tras usar el script: `/srv/quemonesum/current`
- Primera instalación conservada: `/srv/quemonesum/app`
- PM2 process: `quemonesum-test`, listening only on `127.0.0.1:3107`
- Nginx site: `/etc/nginx/sites-available/quemonesum.site`
- HTTPS: Let's Encrypt for `quemonesum.site` and `www.quemonesum.site`, automatic renewal
- Dedicated PostgreSQL database and role: `quemonesum_test`
- PostgreSQL runs in the existing `marketplace-um-postgres-1` container; the marketplace database is unchanged.
- Runtime secrets: `/srv/quemonesum/shared/.env.production` (mode 0600; las versiones enlazan este archivo)
- Moderation panel: `https://quemonesum.site/imagenes-dnewjlfe99474ef8wu-admin`

Production build, public HTTPS, admin login and real pending/approved/rejected
image flows were verified. Temporary test posts were removed afterwards.
The old database was not migrated; this is a new database authorized for testing.

For updates, build locally and upload the application and `.next` output excluding
`.next/cache`, `.env*`, and local dependencies. Install runtime dependencies on the
server with `npm ci --omit=dev`, then restart only `quemonesum-test`. Preserve the
other PM2 processes and Nginx sites. `scripts/provision-test-env.cjs` is first-run
only and refuses to overwrite an existing environment.
