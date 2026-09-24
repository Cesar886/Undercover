#!/usr/bin/env bash
set -Eeuo pipefail
for tool in node npm pm2 docker curl tar flock; do command -v "$tool" >/dev/null; done
[[ -d /srv/quemonesum/app ]]
[[ -r /srv/quemonesum/shared/.env.production || -r /srv/quemonesum/app/.env.production ]]
pm2 describe quemonesum-test >/dev/null
docker inspect --format '{{.State.Running}}' marketplace-um-postgres-1 | grep -qx true
docker exec marketplace-um-postgres-1 sh -c 'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d quemonesum_test -Atc "SELECT 1"' | grep -qx 1
curl -fsS --max-time 15 http://127.0.0.1:3107/api/posts >/dev/null
echo 'SSH, PM2 y PostgreSQL disponibles.'
