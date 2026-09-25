#!/usr/bin/env bash
set -Eeuo pipefail
for tool in node npm pm2 docker curl tar flock systemctl systemd-analyze install; do command -v "$tool" >/dev/null; done
[[ -x /usr/bin/node ]]
[[ -d /run/systemd/system ]]
systemd-analyze calendar 'Mon *-*-* 05:00:00 America/Monterrey' >/dev/null
[[ -d /srv/quemonesum/app ]]
[[ -r /srv/quemonesum/shared/.env.production || -r /srv/quemonesum/app/.env.production ]]
pm2 describe quemonesum-test >/dev/null
docker inspect --format '{{.State.Running}}' marketplace-um-postgres-1 | grep -qx true
docker exec marketplace-um-postgres-1 sh -c 'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d quemonesum_test -Atc "SELECT 1"' | grep -qx 1
curl -fsS --max-time 15 http://127.0.0.1:3107/api/posts >/dev/null
echo 'SSH, PM2, PostgreSQL y systemd con America/Monterrey disponibles.'

# Leave room for CPU dependencies, the extracted build and the database backup.
AVAILABLE_KB="$(df -Pk /srv/quemonesum | awk 'NR == 2 {print $4}')"
if [[ ! "$AVAILABLE_KB" =~ ^[0-9]+$ ]] || (( AVAILABLE_KB < 786432 )); then
  echo 'Espacio insuficiente: se necesitan al menos 768 MiB libres en /srv/quemonesum. Revisa versiones antiguas antes de desplegar.' >&2
  exit 1
fi
printf 'Espacio disponible para desplegar: %s MiB.\n' "$(( AVAILABLE_KB / 1024 ))"
