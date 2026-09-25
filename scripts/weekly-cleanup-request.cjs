// Secrets are loaded in-process and never passed in command-line arguments.
require('@next/env').loadEnvConfig(process.cwd(), false);
(async () => {
  if (!process.env.CRON_SECRET) throw new Error('CRON_SECRET missing');
  const dryRun = process.argv.includes('--dry-run');
  const response = await fetch(`http://127.0.0.1:3107/api/cron/quema?dryRun=${dryRun}`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(15 * 60 * 1000),
  });
  const result = await response.json();
  console.log(JSON.stringify(result));
  if (!response.ok || result.ok !== true || (dryRun && (result.dryRun !== true || result.skipped))) {
    throw new Error('La limpieza/simulación no terminó correctamente');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
