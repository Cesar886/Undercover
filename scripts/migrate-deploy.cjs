// Append-only migration runner. Never runs schema.sql, seeds, provisioning or restores.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('@next/env').loadEnvConfig(process.cwd(), false);
const filesAt = (dir) => fs.readdirSync(dir).filter(n => /^\d.*\.sql$/.test(n)).sort();
const hash = (sql) => crypto.createHash('sha256').update(sql).digest('hex');
function assertAdditive(name, sql) {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
  if (/\b(?:TRUNCATE|DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE|SCHEMA)|DROP\s+COLUMN)\b/i.test(stripped)) {
    throw new Error(name + ': operación destructiva no permitida en el despliegue automático.');
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--baseline-from') throw new Error('Expected --baseline-from <previous deployed migrations>');
  const baselineDir = path.resolve(args[1]);
  if (!baselineDir.startsWith('/srv/quemonesum/')) throw new Error('Baseline must come from the previously deployed server copy.');
  const url = new URL(process.env.DATABASE_URL);
  if (url.pathname !== '/quemonesum_test' || !['127.0.0.1','localhost'].includes(url.hostname)) {
    throw new Error('Refusing to migrate an unexpected database.');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('quemonesum_deploy_migrations'))");
    const exists = await client.query("SELECT to_regclass('public.deploy_migrations') AS name");
    if (!exists.rows[0].name) {
      const tables = await client.query("SELECT to_regclass('public.posts') AS posts, to_regclass('public.image_reviews') AS reviews");
      if (!tables.rows[0].posts || !tables.rows[0].reviews) throw new Error('Expected existing deployed schema; refusing to initialize a database.');
      await client.query('CREATE TABLE deploy_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
      // First deployment: record the SQL already deployed on this server, without replaying it.
      for (const name of filesAt(baselineDir)) {
        const sql = fs.readFileSync(path.join(baselineDir, name), 'utf8');
        await client.query('INSERT INTO deploy_migrations (name,checksum) VALUES ($1,$2)', [name, hash(sql)]);
      }
      console.log('Existing migrations recorded without executing them again.');
    }
    const applied = await client.query('SELECT name,checksum FROM deploy_migrations ORDER BY name');
    const known = new Map(applied.rows.map(r => [r.name, r.checksum]));
    const dir = path.join(process.cwd(), 'sql/migrations');
    const names = filesAt(dir);
    for (const [name, checksum] of known) {
      if (!names.includes(name) || hash(fs.readFileSync(path.join(dir, name), 'utf8')) !== checksum) {
        throw new Error(name + ': una migración aplicada fue modificada o eliminada. Crea un archivo nuevo.');
      }
    }
    const latest = applied.rows.at(-1)?.name ?? '';
    for (const name of names.filter(n => !known.has(n))) {
      if (name <= latest) throw new Error(name + ': las migraciones nuevas deben ir después de las ya aplicadas.');
      const sql = fs.readFileSync(path.join(dir, name), 'utf8');
      assertAdditive(name, sql);
      await client.query(sql);
      await client.query('INSERT INTO deploy_migrations (name,checksum) VALUES ($1,$2)', [name, hash(sql)]);
      console.log('Applied:', name);
    }
    await client.query('COMMIT');
    console.log('Database updated; existing data preserved.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
