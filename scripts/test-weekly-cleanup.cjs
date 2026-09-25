// Isolated PostgreSQL integration test; never loads .env or DATABASE_URL.
// PGLITE_MODULE may point to a temporary installation of @electric-sql/pglite.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const db = new PGlite();
const query = (sql, args) => db.query(sql, args);
const adapter = { query, withTransaction: async (fn) => {
  await query('BEGIN');
  try { const result = await fn({ query }); await query('COMMIT'); return result; }
  catch (error) { await query('ROLLBACK'); throw error; }
} };
require.cache[require.resolve('../lib/db.ts')] = { exports: adapter };
const { runQuema, isQuemaTime } = require('../lib/quema.ts');
// The runtime schema setup is multi-statement; expose it using exec.
adapter.query = (sql, args) => !args && sql.includes('CREATE TABLE') ? db.exec(sql).then(() => ({ rows: [] })) : query(sql, args);
const { reviewImage, deleteImageReview } = require('../lib/imageReviews.ts');
const monday = new Date('2026-09-28T11:00:00Z');
const scalar = async sql => Object.values((await query(sql)).rows[0])[0];
(async () => {
  await db.exec(fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
  for (const name of fs.readdirSync(path.join(__dirname, '../sql/migrations')).sort()) {
    await db.exec(fs.readFileSync(path.join(__dirname, '../sql/migrations', name), 'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
  }
  await db.exec(fs.readFileSync(path.join(__dirname, '../sql/notifications.sql'), 'utf8'));
  assert(isQuemaTime(monday));
  assert(!isQuemaTime(new Date('2026-09-28T05:00:00Z')));
  assert(!isQuemaTime(new Date('2026-09-28T11:01:00Z')));
  assert(isQuemaTime(new Date('2026-01-05T11:00:00Z')));
  assert(isQuemaTime(new Date('2022-07-04T10:00:00Z'))); // Historical DST, no fixed offset.
  const posts = (await query(`INSERT INTO posts(anon_id,content,category,is_hidden,image_webp,is_seed) VALUES
    ('u','visible','general',false,'post-visible',false),
    ('u','hidden','general',true,'post-hidden',false),
    ('seed','seed','general',false,'seed-image',true) RETURNING id`)).rows;
  const [visible, hidden, seed] = posts.map(r => r.id);
  await query(`INSERT INTO categories(slug,name,description,creator_anon_id)
    VALUES('prueba','Prueba','Categoría creada por un usuario','u')`);
  const comment = (await query(`INSERT INTO comments(post_id,anon_id,content,image_webp) VALUES($1,'u','comment','comment-image') RETURNING id`, [visible])).rows[0].id;
  await query(`INSERT INTO image_reviews(post_id,image_data,status,public_visible) VALUES($1,'post-visible','approved',true),($2,'post-hidden','rejected',false)`, [visible, hidden]);
  await query(`INSERT INTO votes(post_id,voter_token,vote_type) VALUES($1,'v','up')`, [visible]);
  await query(`INSERT INTO reports(target_type,target_id,reason,reporter_id) VALUES('comment',$1,'spam','u')`, [comment]);
  await query(`INSERT INTO notifications(recipient_username,type,post_id,comment_id) VALUES('u','post_comment',$1,$2)`, [visible, comment]);
  const before = await scalar('SELECT jsonb_agg(to_jsonb(p))::text FROM posts p');
  const dry = await runQuema({ dryRun: true, now: monday });
  assert.equal(dry.counts.posts, 2); assert.equal(dry.counts.comments, 1); assert.equal(dry.counts.categories, 1); assert.equal(dry.counts.images_hidden, 2);
  assert.equal(await scalar('SELECT jsonb_agg(to_jsonb(p))::text FROM posts p'), before);
  assert.equal(await scalar('SELECT count(*)::int FROM weekly_cleanup_backups'), 0);
  assert.equal(await scalar('SELECT count(*)::int FROM weekly_cleanup_runs'), 0);
  // Backup failure must abort all deletion.
  await db.exec(`CREATE FUNCTION fail_backup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test backup failure'; END $$;
    CREATE TRIGGER fail_backup BEFORE INSERT ON weekly_cleanup_backups FOR EACH ROW EXECUTE FUNCTION fail_backup();`);
  await assert.rejects(runQuema({ dryRun: false, now: monday }), /test backup failure/);
  assert.equal(await scalar('SELECT count(*)::int FROM posts'), 3);
  await db.exec('DROP TRIGGER fail_backup ON weekly_cleanup_backups');
  const result = await runQuema({ dryRun: false, now: monday });
  assert.equal(result.counts.posts, 2);
  assert.equal(await scalar('SELECT count(*)::int FROM posts'), 1);
  assert.equal(await scalar('SELECT image_webp FROM posts'), 'seed-image');
  assert.equal(await scalar('SELECT count(*)::int FROM comments'), 0);
  assert.equal(await scalar('SELECT count(*)::int FROM image_reviews'), 3);
  assert.equal(await scalar("SELECT count(*)::int FROM image_reviews WHERE image_data IN ('post-visible','post-hidden','comment-image')"), 3);
  assert.equal(await scalar('SELECT count(*)::int FROM image_reviews WHERE public_visible'), 0);
  assert.equal(await scalar('SELECT count(*)::int FROM categories'), 5);
  assert.equal(await scalar('SELECT count(*)::int FROM reports'), 0);
  const backup = (await query('SELECT * FROM weekly_cleanup_backups')).rows[0];
  assert.equal(backup.payload.posts.length, 2); assert.equal(backup.payload.comments.length, 1);
  assert.equal(backup.payload.categories.length, 1);
  assert.equal(backup.payload.votes.length, 1); assert.equal(backup.payload.notifications.length, 1);
  assert.equal(new Date(backup.expires_at) - new Date(backup.created_at), 21 * 86400000);
  const imageId = (await query('SELECT id FROM image_reviews WHERE post_id=$1', [visible])).rows[0].id;
  for (const decision of ['approved','rejected','approved','hidden']) assert(await reviewImage(imageId, decision));
  assert(await deleteImageReview(imageId));
  assert.equal(await scalar(`SELECT count(*)::int FROM image_reviews`), 3);
  await assert.rejects(query('DELETE FROM image_reviews'), /Images are permanent/);
  await assert.rejects(query("UPDATE image_reviews SET image_data='changed'"), /immutable/);
  await assert.rejects(query('TRUNCATE image_reviews'), /Images are permanent/);
  assert((await runQuema({ dryRun: false, now: monday })).skipped);
  // A later failure rolls back deletion AND backup, with a durable error log.
  await db.exec(`CREATE FUNCTION fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test delete failure'; END $$;
    CREATE TRIGGER fail_delete BEFORE DELETE ON posts FOR EACH ROW EXECUTE FUNCTION fail_delete();`);
  await query("INSERT INTO posts(anon_id,content,category) VALUES('u','next','general')");
  await assert.rejects(runQuema({ dryRun: false, now: new Date('2026-10-05T11:00:00Z') }), /test delete failure/);
  assert.equal(await scalar('SELECT count(*)::int FROM posts'), 2);
  assert.equal(await scalar('SELECT count(*)::int FROM weekly_cleanup_backups'), 1);
  await db.exec('DROP TRIGGER fail_delete ON posts');
  // Expired backups are purged, current backups and permanent images are retained.
  await query("UPDATE weekly_cleanup_backups SET expires_at=NOW()-INTERVAL '1 second'");
  await runQuema({ dryRun: false, now: new Date('2026-10-05T11:00:00Z') });
  assert.equal(await scalar('SELECT count(*)::int FROM weekly_cleanup_backups'), 1);
  assert.equal(await scalar('SELECT count(*)::int FROM image_reviews'), 3);
  // Admin hide/unhide round trips preserve bytes and restore live sources.
  for (const kind of ['post', 'comment']) {
    for (const imageOnly of [false, true]) {
      const parent = (await query(`INSERT INTO posts(anon_id,content,category,image_webp) VALUES('u',$1,'general',$2) RETURNING id`, [imageOnly ? '' : 'text', kind === 'post' ? 'roundtrip' : null])).rows[0].id;
      const source = kind === 'post' ? parent : (await query(`INSERT INTO comments(post_id,anon_id,content,image_webp) VALUES($1,'u',$2,'roundtrip') RETURNING id`, [parent, imageOnly ? '' : 'text'])).rows[0].id;
      const column = kind === 'post' ? 'post_id' : 'comment_id';
      const table = kind === 'post' ? 'posts' : 'comments';
      const review = (await query(`INSERT INTO image_reviews(${column},image_data,status,public_visible) VALUES($1,'roundtrip','approved',true) RETURNING id`, [source])).rows[0].id;
      for (let iteration = 0; iteration < 2; iteration++) {
        assert(await reviewImage(review, 'hidden'));
        assert.equal((await query(`SELECT image_webp FROM ${table} WHERE id=$1`, [source])).rows[0].image_webp, null);
        assert(await reviewImage(review, 'approved'));
        const restored = (await query(`SELECT * FROM ${table} WHERE id=$1`, [source])).rows[0];
        assert.equal(restored.image_webp, 'roundtrip');
        assert.equal(restored.is_hidden, false);
        if (kind === 'comment') assert.equal(restored.is_deleted, false);
        const image = (await query('SELECT * FROM image_reviews WHERE id=$1', [review])).rows[0];
        assert.equal(image.public_visible, true); assert.equal(image.image_data, 'roundtrip');
      }
    }
  }
  console.log('PASS: timezone/DST, dry-run, seeds, backup failure, rollback, retention, idempotency, permanent images and orphan moderation');
})().finally(() => db.close()).catch(error => { console.error(error); process.exitCode = 1; });
