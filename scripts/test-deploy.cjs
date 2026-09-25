// Deployment safety tests use temporary files and mocked server commands; no SSH/DB.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { spawnSync } = require('child_process');
const { assertAdditive } = require('./migrate-deploy.cjs');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'quemonesum-deploy-tests-'));
const write = (name, content, mode = 0o644) => { fs.mkdirSync(path.dirname(name), { recursive: true }); fs.writeFileSync(name, content, { mode }); };
const run = (command, args, options = {}) => spawnSync(command, args, { encoding: 'utf8', ...options });
try {
  assert.doesNotThrow(() => assertAdditive('010', fs.readFileSync(path.join(root, 'sql/migrations/010_weekly_cleanup.sql'), 'utf8')));
  for (const sql of ['DELETE FROM posts', 'TRUNCATE posts', 'DROP TABLE posts', 'ALTER TABLE posts DROP COLUMN content', "DO $$ BEGIN EXECUTE 'DELETE FROM posts'; END $$;", "DO $$ BEGIN EXECUTE 'TRUNCATE' || ' posts'; END $$;"]) {
    assert.throws(() => assertAdditive('unsafe', sql));
  }
  assert.doesNotThrow(() => assertAdditive('011', fs.readFileSync(path.join(root, 'sql/migrations/011_reports_without_ip.sql'), 'utf8')));
  const secretDir = path.join(temporary, 'secret');
  write(path.join(secretDir, '.env.production'), 'DATABASE_URL=postgres://preserve-me\nADMIN_PASSWORD=preserve-me\nCRON_SECRET=\n');
  const env = { ...process.env, CRON_SECRET: '' };
  const secretScript = path.join(root, 'scripts/ensure-cleanup-secret.cjs');
  let response = run(process.execPath, [secretScript], { cwd: secretDir, env });
  assert.equal(response.status, 0, response.stderr);
  const first = fs.readFileSync(path.join(secretDir, '.env.production'), 'utf8');
  assert(first.includes('ADMIN_PASSWORD=preserve-me'));
  assert.match(first, /CRON_SECRET=[a-f0-9]{64}/);
  response = run(process.execPath, [secretScript], { cwd: secretDir, env });
  assert.equal(response.status, 0, response.stderr);
  assert.equal(fs.readFileSync(path.join(secretDir, '.env.production'), 'utf8'), first);
  assert.equal(fs.statSync(path.join(secretDir, '.env.production')).mode & 0o777, 0o600);

  for (const failDryRun of [false, true]) {
    const base = path.join(temporary, failDryRun ? 'failure' : 'success');
    const bin = path.join(base, 'bin');
    const log = path.join(base, 'commands.log');
    const release = '20260924T180000Z-12345678';
    write(path.join(base, 'app/.env.production'), 'CRON_SECRET=test\n');
    fs.mkdirSync(path.join(base, 'incoming'), { recursive: true });
    fs.mkdirSync(path.join(base, 'units'), { recursive: true });
    const payload = path.join(base, 'payload');
    for (const file of ['deploy/quemonesum-cleanup.service', 'deploy/quemonesum-cleanup.timer']) write(path.join(payload, file), fs.readFileSync(path.join(root, file)));
    assert.equal(run('tar', ['-czf', path.join(base, 'incoming', release + '.tar.gz'), '-C', payload, '.']).status, 0);
    const stub = (name, body) => write(path.join(bin, name), '#!/usr/bin/env bash\nset -eu\nprintf "%s\\n" "' + name + ' $*" >> "$TEST_LOG"\n' + body + '\n', 0o755);
    stub('npm', '[[ "${npm_config_onnxruntime_node_install_cuda:-}" == skip ]]');
    stub('docker', 'if [[ "$*" == *pg_restore* ]]; then cat >/dev/null; else printf "test-backup"; fi');
    stub('curl', 'printf "{}"');
    stub('node', `case "$*" in
      *migrate-deploy.cjs*) exit 0 ;;
      *ensure-cleanup-secret.cjs*) exit 0 ;;
      *weekly-cleanup-request.cjs*) [[ "$*" == *--dry-run* ]]; exit "$FAIL_DRY_RUN" ;;
      *) exec "${process.execPath}" "$@" ;;
    esac`);
    stub('pm2', `case "$1" in
      start) cp "$2" "$TEST_BASE/active.json" ;;
      jlist) "${process.execPath}" -e 'const c=require(process.argv[1]).apps[0];process.stdout.write(JSON.stringify([{name:c.name,pm2_env:{pm_cwd:c.cwd,status:"online",...c.env}}]));' "$TEST_BASE/active.json" ;;
    esac`);
    stub('systemctl', 'exit 0');
    stub('systemd-analyze', 'exit 0');
    const source = fs.readFileSync(path.join(root, 'deploy/release-server.sh'), 'utf8')
      .replace('BASE=/srv/quemonesum', `BASE=${base}`)
      .replaceAll('/etc/systemd/system/', base + '/units/');
    const script = path.join(base, 'release.sh');
    write(script, source);
    response = run('bash', [script, release], { env: { ...process.env, PATH: bin + ':' + process.env.PATH, TEST_LOG: log, TEST_BASE: base, FAIL_DRY_RUN: failDryRun ? '1' : '0' } });
    const commands = fs.readFileSync(log, 'utf8');
    assert(commands.indexOf('pg_dump') < commands.indexOf('migrate-deploy'));
    assert(commands.includes('weekly-cleanup-request.cjs --dry-run'));
    const active = JSON.parse(fs.readFileSync(path.join(base, 'active.json'), 'utf8')).apps[0];
    if (failDryRun) {
      assert.notEqual(response.status, 0);
      assert(!commands.includes('systemctl enable --now'));
      assert.equal(active.cwd, base + '/app');
      assert.equal(active.env.WEEKLY_CLEANUP_ENABLED, 'false');
      assert.equal(fs.realpathSync(path.join(base, 'current')), base + '/app');
    } else {
      assert.equal(response.status, 0, response.stderr);
      assert(commands.indexOf('--dry-run') < commands.indexOf('systemctl enable --now'));
      assert.equal(active.env.WEEKLY_CLEANUP_ENABLED, 'true');
      assert.equal(fs.realpathSync(path.join(base, 'current')), base + '/releases/' + release);
      assert(fs.existsSync(path.join(base, 'units/quemonesum-cleanup.timer')));
    }
    assert.equal(fs.readFileSync(path.join(base, 'shared/.env.production'), 'utf8'), 'CRON_SECRET=test\n');
  }
  // Exercise the real local packaging script with network/build commands mocked.
  const packaging = path.join(temporary, 'packaging');
  const packagingBin = path.join(packaging, 'bin');
  const listing = path.join(packaging, 'archive.txt');
  write(path.join(packagingBin, 'npm'), `#!/usr/bin/env bash
set -eu
mkdir -p .next/server
printf 'test-build' > .next/BUILD_ID
printf '{"middleware":{"/":{}}}' > .next/server/middleware-manifest.json
`, 0o755);
  write(path.join(packagingBin, 'ssh'), '#!/usr/bin/env bash\nexit 0\n', 0o755);
  write(path.join(packagingBin, 'scp'), '#!/usr/bin/env bash\nset -eu\ntar -tzf "$2" > "$TEST_ARCHIVE_LIST"\n', 0o755);
  response = run('bash', [path.join(root, 'deploy.sh')], { env: { ...process.env, PATH: packagingBin + ':' + process.env.PATH, TEST_ARCHIVE_LIST: listing } });
  assert.equal(response.status, 0, response.stderr);
  const files = fs.readFileSync(listing, 'utf8').split('\n');
  for (const file of ['app/page.tsx', 'app/api/posts/route.ts', 'lib/db.ts', 'sql/schema.sql', 'sql/migrations/010_weekly_cleanup.sql', 'deploy/quemonesum-cleanup.timer', 'scripts/weekly-cleanup-request.cjs', 'deploy.sh', 'vercel.json', 'docs/weekly-cleanup.md', '.next/BUILD_ID']) assert(files.includes(file), file + ' missing');
  assert(!files.some(file => /(^|\/)\.env|node_modules|\.dump$/.test(file)));
  console.log('PASS: migration guard, credential preservation, backup before migration, automatic timer activation after dry-run, rollback with cleanup disabled, full app/API/SQL upload manifest');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
