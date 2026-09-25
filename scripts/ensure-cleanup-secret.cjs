// Only fill a missing cron credential in the existing remote runtime environment.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { loadEnvConfig } = require('@next/env');
// An empty inherited variable must not mask an existing credential in the file.
if (!process.env.CRON_SECRET?.trim()) delete process.env.CRON_SECRET;
loadEnvConfig(process.cwd(), false);
if (!process.env.CRON_SECRET?.trim()) {
  const envPath = fs.realpathSync(path.join(process.cwd(), '.env.production'));
  const original = fs.readFileSync(envPath, 'utf8');
  const secret = crypto.randomBytes(32).toString('hex');
  const updated = original.replace(/^\s*(?:export\s+)?CRON_SECRET\s*=.*$/gm, '') + `\nCRON_SECRET=${secret}\n`;
  const temporary = `${envPath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, updated, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, envPath);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  console.log('Credencial de limpieza generada en el servidor.');
} else {
  console.log('Credencial de limpieza existente conservada.');
}
