import { randomUUID } from 'crypto';
import { query, withTransaction } from './db';

export const QUEMA_TIMEZONE = 'America/Monterrey';
export function localCleanupDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: QUEMA_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function isQuemaTime(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: QUEMA_TIMEZONE, weekday: 'short', hour: '2-digit', hourCycle: 'h23', minute: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return get('weekday') === 'Mon' && get('hour') === '05' && get('minute') === '00';
}

// Defaults to simulation, including when called outside the HTTP route.
export async function runQuema({ dryRun = true, now = new Date() } = {}) {
  const id = randomUUID();
  const localDate = localCleanupDate(now);
  try {
    const result = await withTransaction(async (client) => {
      if (dryRun) await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      else {
        if (!isQuemaTime(now)) throw new Error('Outside Monday 05:00 America/Monterrey');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('weekly_cleanup'))");
        const previous = await client.query("SELECT id FROM weekly_cleanup_runs WHERE local_date=$1 AND status='success'", [localDate]);
        if (previous.rowCount) return { dryRun, skipped: true, reason: 'already completed', counts: {} };
        // Freeze candidate rows and dependencies until snapshot + deletion commit together.
        await client.query(`LOCK TABLE posts, comments, categories, image_reviews, votes, comment_votes,
          post_reactions, comment_reactions, post_polls, post_poll_options, post_poll_votes,
          reports, notifications IN SHARE ROW EXCLUSIVE MODE`);
      }
      const posts = await client.query(`SELECT p.* FROM posts p WHERE NOT p.is_seed
        AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.post_id=p.id AND c.is_seed)`);
      const postIds = posts.rows.map(r => r.id);
      const comments = await client.query('SELECT * FROM comments WHERE post_id=ANY($1::uuid[])', [postIds]);
      const commentIds = comments.rows.map(r => r.id);
      const snapshot: Record<string, unknown[]> = { posts: posts.rows, comments: comments.rows };
      const counts: Record<string, number> = {};
      for (const [table, predicate, ids] of [
        ['votes', 'post_id=ANY($1::uuid[])', postIds],
        ['comment_votes', 'comment_id=ANY($1::uuid[])', commentIds],
        ['post_reactions', 'post_id=ANY($1::uuid[])', postIds],
        ['comment_reactions', 'comment_id=ANY($1::uuid[])', commentIds],
        ['post_polls', 'post_id=ANY($1::uuid[])', postIds],
        ['post_poll_options', 'poll_id IN (SELECT id FROM post_polls WHERE post_id=ANY($1::uuid[]))', postIds],
        ['post_poll_votes', 'poll_id IN (SELECT id FROM post_polls WHERE post_id=ANY($1::uuid[]))', postIds],
      ] as const) {
        snapshot[table] = (await client.query(`SELECT * FROM ${table} WHERE ${predicate}`, [ids])).rows;
      }
      snapshot.reports = (await client.query(`SELECT * FROM reports WHERE
        (target_type='post' AND target_id=ANY($1::uuid[])) OR
        (target_type='comment' AND target_id=ANY($2::uuid[]))`, [postIds, commentIds])).rows;
      snapshot.notifications = (await client.query(`SELECT * FROM notifications WHERE
        post_id=ANY($1::uuid[]) OR comment_id=ANY($2::uuid[])`, [postIds, commentIds])).rows;
      // User-created boards are ephemeral too; system categories are permanent.
      snapshot.categories = (await client.query('SELECT * FROM categories WHERE NOT is_system')).rows;
      for (const [table, rows] of Object.entries(snapshot)) counts[table] = rows.length;
      counts.posts_hidden = posts.rows.filter(r => r.is_hidden || r.owner_hidden).length;
      counts.posts_visible = posts.rows.length - counts.posts_hidden;
      counts.comments_hidden = comments.rows.filter(r => r.is_hidden || r.owner_hidden || r.is_deleted).length;
      counts.comments_visible = comments.rows.length - counts.comments_hidden;
      // Count actual publicly accessible images rather than moderation status alone.
      const publicImages = await client.query(`SELECT COUNT(*)::int AS count FROM (
        SELECT p.id FROM posts p WHERE p.id=ANY($1::uuid[]) AND p.image_webp IS NOT NULL AND NOT (p.is_hidden OR p.owner_hidden OR p.archived)
        UNION ALL
        SELECT c.id FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=ANY($2::uuid[]) AND c.image_webp IS NOT NULL
          AND NOT (c.is_hidden OR c.owner_hidden OR c.is_deleted OR p.is_hidden OR p.owner_hidden OR p.archived)
      ) images`, [postIds, commentIds]);
      counts.images_hidden = publicImages.rows[0].count;
      if (dryRun) return { dryRun, skipped: false, counts };

      // A failed backup aborts everything. PostgreSQL commits backup + deletion atomically.
      const backup = await client.query('INSERT INTO weekly_cleanup_backups(payload) VALUES($1::jsonb) RETURNING id', [JSON.stringify(snapshot)]);
      await client.query(`UPDATE image_reviews SET public_visible=FALSE WHERE public_visible AND
        (post_id=ANY($1::uuid[]) OR comment_id=ANY($2::uuid[]))`, [postIds, commentIds]);
      // Triggers archive legacy bytes before deleting sources. Seed rows remain intact.
      await client.query('DELETE FROM reports WHERE id=ANY($1::uuid[])', [snapshot.reports.map(r => (r as { id: string }).id)]);
      await client.query('DELETE FROM notifications WHERE id=ANY($1::uuid[])', [snapshot.notifications.map(r => (r as { id: string }).id)]);
      await client.query('DELETE FROM posts WHERE id=ANY($1::uuid[])', [postIds]);
      await client.query('DELETE FROM categories WHERE NOT is_system');
      await client.query(`INSERT INTO weekly_cleanup_runs(id,started_at,local_date,status,backup_id,counts)
        VALUES($1,$2,$3,'success',$4,$5::jsonb)`, [id, now, localDate, backup.rows[0].id, JSON.stringify(counts)]);
      await client.query('DELETE FROM weekly_cleanup_backups WHERE expires_at <= NOW()');
      return { dryRun, skipped: false, counts, backupId: backup.rows[0].id };
    });
    console.log(JSON.stringify({ job: 'weekly-cleanup', id, startedAt: now.toISOString(), finishedAt: new Date().toISOString(), timeZone: QUEMA_TIMEZONE, ...result }));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ job: 'weekly-cleanup', id, startedAt: now.toISOString(), dryRun, error: message }));
    if (!dryRun) {
      try {
        await query(`INSERT INTO weekly_cleanup_runs(id,started_at,local_date,status,error)
          VALUES($1,$2,$3,'error',$4)`, [id, now, localDate, message]);
      } catch (logError) { console.error('[weekly-cleanup] audit unavailable', logError); }
    }
    throw error;
  }
}
