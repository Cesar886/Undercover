const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('@next/env').loadEnvConfig(process.cwd(), false);
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync('sql/schema.sql', 'utf8'));
    for (const name of fs.readdirSync('sql/migrations').filter(x => x.endsWith('.sql')).sort()) {
      await client.query(fs.readFileSync(path.join('sql/migrations', name), 'utf8'));
    }
    await client.query(fs.readFileSync('sql/notifications.sql', 'utf8'));
    await client.query('COMMIT');
    console.log('Database schema initialized.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await pool.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
