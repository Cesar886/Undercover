#!/usr/bin/env bash
set -Eeuo pipefail
# Publish app + API + database migrations. Preserve remote data and secrets.
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER="root@164.90.129.213"
BASE="/srv/quemonesum"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 "$SERVER")
MODE="${1:-deploy}"
case "$MODE" in
  --help|-h)
    printf '%s\n' 'Uso: ./deploy.sh [--check]' 'Sin argumentos: compila frontend/backend, respalda y migra la DB remota, publica y activa la limpieza semanal.' '--check: comprueba requisitos y acceso sin modificar el servidor.'
    exit 0 ;;
  deploy|--check) ;;
  *) printf 'Opción desconocida: %s\n' "$MODE" >&2; exit 2 ;;
esac
[[ $# -le 1 ]] || { echo 'Demasiados argumentos.' >&2; exit 2; }
for cmd in node npm ssh scp tar flock; do command -v "$cmd" >/dev/null || { echo "Falta $cmd" >&2; exit 1; }; done
cd "$ROOT"
exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { echo 'Ya hay otro despliegue local en curso.' >&2; exit 1; }
[[ -d node_modules ]] || { echo 'Primero ejecuta npm ci en el proyecto.' >&2; exit 1; }

echo 'Comprobando servidor…'
"${SSH[@]}" 'bash -s' < "$ROOT/deploy/check-server.sh"
if [[ "$MODE" == --check ]]; then echo 'Comprobación correcta. No se cambió el servidor.'; exit 0; fi

STAGING="$(mktemp -d /tmp/quemonesum-deploy.XXXXXXXX)"
cleanup() {
  # Only the exact directory created by mktemp; never the project or a variable supplied by a caller.
  if [[ "$STAGING" == /tmp/quemonesum-deploy.* && -d "$STAGING" ]]; then rm -rf -- "$STAGING"; fi
}
trap cleanup EXIT
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)-$(node -e 'process.stdout.write(require("crypto").randomBytes(4).toString("hex"))')"
SOURCE=(app components hooks lib public types sql scripts deploy docs deploy.sh README.md vercel.json middleware.ts package.json package-lock.json next.config.mjs next-env.d.ts postcss.config.mjs tailwind.config.ts tsconfig.json)
echo 'Preparando una copia de los cambios locales para compilar…'
tar --exclude='.env*' --exclude='*.dump' --exclude='*.sqlite*' --exclude='uploads' -cf - "${SOURCE[@]}" | tar -xf - -C "$STAGING"
ln -s "$ROOT/node_modules" "$STAGING/node_modules"
(
  cd "$STAGING"
  NEXT_PUBLIC_BASE_URL=https://quemonesum.site npm run build
)
[[ -s "$STAGING/.next/BUILD_ID" ]] || { echo 'No se generó BUILD_ID.' >&2; exit 1; }
node - "$STAGING/.next/server/middleware-manifest.json" <<'NODE'
const manifest = require(process.argv[2]);
if (!manifest.middleware['/']) throw new Error('La compilación no incluye el middleware requerido.');
NODE
tar -C "$STAGING" --exclude='.next/cache' --exclude='node_modules' --exclude='.env*' --exclude='*.dump' --exclude='*.sqlite*' --exclude='uploads' -czf "$STAGING/release.tar.gz" "${SOURCE[@]}" .next
echo "Subiendo versión $RELEASE…"
"${SSH[@]}" "mkdir -p '$BASE/incoming'"
scp -q "$STAGING/release.tar.gz" "$SERVER:$BASE/incoming/$RELEASE.tar.gz"
"${SSH[@]}" "bash -s -- '$RELEASE'" < "$ROOT/deploy/release-server.sh"
echo 'Publicado: https://quemonesum.site'
