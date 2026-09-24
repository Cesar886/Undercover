// Run once on the authorized test server, inside /srv/quemonesum/app.
const fs = require('fs');
const { randomBytes } = require('crypto');
const { execFileSync } = require('child_process');
const dest = '/srv/quemonesum/app/.env.production';
if (fs.existsSync(dest)) throw new Error('Environment already exists; refusing to overwrite.');
const password = randomBytes(32).toString('hex');
const sql = "CREATE ROLE quemonesum_test LOGIN PASSWORD '" + password + "';\nCREATE DATABASE quemonesum_test OWNER quemonesum_test;\n";
execFileSync('docker', ['exec', '-i', 'marketplace-um-postgres-1', 'sh', '-c',
  'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] });
const secret = () => randomBytes(32).toString('hex');
fs.writeFileSync(dest, [
  'DATABASE_URL=postgresql://quemonesum_test:' + password + '@127.0.0.1:5432/quemonesum_test',
  'ANON_SALT=' + secret(), 'SESSION_SECRET=' + secret(), 'ADMIN_SECRET=' + secret(),
  'CRON_SECRET=' + secret(), 'NEXT_PUBLIC_BASE_URL=https://quemonesum.site',
  'NODE_ENV=production', ''
].join('\n'), { mode: 0o600 });
console.log('Dedicated test database and environment created.');
