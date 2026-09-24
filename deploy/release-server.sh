#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
BASE=/srv/quemonesum
NAME=quemonesum-test
RELEASE="${1:?Falta identificador}"
[[ "$RELEASE" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$ ]] || exit 2
mkdir -p "$BASE/releases" "$BASE/shared" "$BASE/backups"
exec 9>"$BASE/deploy.lock"
flock -n 9 || { echo 'Ya hay otro despliegue remoto en curso.' >&2; exit 1; }
ARCHIVE="$BASE/incoming/$RELEASE.tar.gz"
TARGET="$BASE/releases/$RELEASE"
PREVIOUS="$(readlink -f "$BASE/current" 2>/dev/null || true)"
if [[ ! -d "$PREVIOUS" ]]; then PREVIOUS="$BASE/app"; fi
[[ "$PREVIOUS" == "$BASE/app" || "$PREVIOUS" == "$BASE/releases/"* ]] || exit 2
[[ -s "$ARCHIVE" && ! -e "$TARGET" ]]
mkdir "$TARGET"
tar -xzf "$ARCHIVE" -C "$TARGET"

# Keep the original runtime environment; a local .env can never replace it.
if [[ ! -e "$BASE/shared/.env.production" ]]; then
  cp "$BASE/app/.env.production" "$BASE/shared/.env.production"
  chmod 600 "$BASE/shared/.env.production"
fi
[[ ! -e "$TARGET/.env.production" ]]
ln -s "$BASE/shared/.env.production" "$TARGET/.env.production"

echo 'Instalando dependencias de producción…'
(cd "$TARGET" && npm ci --omit=dev --prefer-offline --no-audit --no-fund)

echo 'Respaldando exclusivamente quemonesum_test…'
BACKUP="$BASE/backups/$RELEASE.dump"
docker exec marketplace-um-postgres-1 sh -c 'exec pg_dump -U "$POSTGRES_USER" -d quemonesum_test -Fc' > "$BACKUP"
[[ -s "$BACKUP" ]]
docker exec -i marketplace-um-postgres-1 pg_restore --list < "$BACKUP" >/dev/null

echo 'Aplicando únicamente migraciones nuevas…'
(cd "$TARGET" && node scripts/migrate-deploy.cjs --baseline-from "$PREVIOUS/sql/migrations")

start_version() {
  local directory="$1"
  node - "$directory" "$BASE/pm2-deploy.json" <<'NODE'
const fs = require('fs'), path = require('path');
const [directory, target] = process.argv.slice(2);
fs.writeFileSync(target, JSON.stringify({ apps: [{
  name: 'quemonesum-test', cwd: directory,
  script: path.join(directory, 'node_modules/next/dist/bin/next'),
  args: 'start -H 127.0.0.1 -p 3107',
  exec_mode: 'fork', instances: 1,
  env: { NODE_ENV: 'production' }, autorestart: true
}] }));
NODE
  # PM2 reload retains the previous pm_cwd/pm_exec_path on some versions.
  # Replace only this process entry so the new release is actually executed.
  if pm2 describe "$NAME" >/dev/null 2>&1; then
    pm2 delete "$NAME"
  fi
  pm2 start "$BASE/pm2-deploy.json" --only "$NAME"
}

SWITCHED=0
rollback_code() {
  local code=$?
  trap - ERR
  if [[ "$SWITCHED" == 1 ]]; then
    echo 'Falló la nueva versión. Restaurando solo el código anterior…' >&2
    if start_version "$PREVIOUS"; then
      ln -sfn "$PREVIOUS" "$BASE/current"
      pm2 save
    else
      echo "No se pudo arrancar $PREVIOUS; revisa PM2." >&2
    fi
  fi
  echo "Despliegue fallido. La base NO fue restaurada ni reemplazada. Respaldo: $BACKUP" >&2
  exit "$code"
}
trap rollback_code ERR
SWITCHED=1
start_version "$TARGET"
healthy=0
for attempt in {1..30}; do
  if curl -fsS --max-time 5 http://127.0.0.1:3107/api/posts >/dev/null &&
     curl -fsS --max-time 5 http://127.0.0.1:3107/api/categories >/dev/null; then
    healthy=1; break
  fi
  sleep 2
done
[[ "$healthy" == 1 ]]
# Check that PM2 really changed its working directory, not just its restart counter.
pm2 jlist | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="quemonesum-test");if(!p||p.pm2_env.pm_cwd!==process.argv[1]||p.pm2_env.status!=="online")process.exit(1);});' "$TARGET"
curl -fsS --max-time 15 https://quemonesum.site/api/posts >/dev/null
ln -sfn "$TARGET" "$BASE/current"
pm2 save
trap - ERR
echo "Versión activa: $RELEASE"
echo "Anterior conservada: $PREVIOUS"
echo "Respaldo DB conservado: $BACKUP"
echo 'Solo se reinició quemonesum-test. Los demás procesos no se modificaron.'
