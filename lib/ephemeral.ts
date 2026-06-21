import { PoolClient } from 'pg';
import { query, withTransaction } from './db';

export const MAX_THREADS_PER_CATEGORY = 150;
export const MAX_THREAD_AGE_DAYS      = 7;
export const MAX_INACTIVITY_DAYS      = 3;
export const ARCHIVE_MIN_SCORE        = 10; // upvotes - downvotes
export const ARCHIVE_MIN_COMMENTS     = 5;

async function deletePostCascade(postId: string, client: PoolClient): Promise<void> {
  await client.query(
    `DELETE FROM comment_votes
     WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)`,
    [postId]
  );
  await client.query(`DELETE FROM votes         WHERE post_id = $1`, [postId]);
  await client.query(`DELETE FROM comments      WHERE post_id = $1`, [postId]);
  await client.query(`DELETE FROM notifications WHERE post_id = $1`, [postId]);
  await client.query(`DELETE FROM posts         WHERE id      = $1`, [postId]);
}

/**
 * Called after a new post is created.
 * If the category now exceeds MAX_THREADS_PER_CATEGORY, the least-recently
 * bumped thread is archived (if popular enough) or deleted.
 */
export async function pruneCategory(category: string, client: PoolClient): Promise<void> {
  const countRes = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM posts
     WHERE category = $1 AND archived = FALSE AND is_hidden = FALSE`,
    [category]
  );
  const count = parseInt(countRes.rows[0].n, 10);
  if (count <= MAX_THREADS_PER_CATEGORY) return;

  const oldest = await client.query<{ id: string; upvotes: number; downvotes: number }>(
    `SELECT id, upvotes, downvotes FROM posts
     WHERE category = $1 AND archived = FALSE AND is_hidden = FALSE
     ORDER BY last_bumped_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED`,
    [category]
  );
  if (oldest.rows.length === 0) return;

  const post = oldest.rows[0];
  const commentRes = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM comments WHERE post_id = $1`,
    [post.id]
  );
  const commentCount = parseInt(commentRes.rows[0].n, 10);
  const score        = post.upvotes - post.downvotes;

  if (score >= ARCHIVE_MIN_SCORE || commentCount >= ARCHIVE_MIN_COMMENTS) {
    await client.query(`UPDATE posts SET archived = TRUE WHERE id = $1`, [post.id]);
  } else {
    await deletePostCascade(post.id, client);
  }
}

/**
 * Called by the cron endpoint every hour.
 * Expires threads that are too old or have been inactive too long.
 * Popular threads are archived; the rest are deleted.
 */
export async function cleanupExpired(): Promise<{ archived: number; deleted: number }> {
  const expired = await query(
    `SELECT p.id, p.upvotes, p.downvotes,
       (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count
     FROM posts p
     WHERE p.archived = FALSE AND p.is_hidden = FALSE
       AND (
         p.created_at    < NOW() - INTERVAL '${MAX_THREAD_AGE_DAYS} days'
         OR p.last_bumped_at < NOW() - INTERVAL '${MAX_INACTIVITY_DAYS} days'
       )`
  );

  let archived = 0;
  let deleted  = 0;

  for (const post of expired.rows as {
    id: string; upvotes: number; downvotes: number; comment_count: number;
  }[]) {
    const score    = post.upvotes - post.downvotes;
    const comments = post.comment_count;

    if (score >= ARCHIVE_MIN_SCORE || comments >= ARCHIVE_MIN_COMMENTS) {
      await query(`UPDATE posts SET archived = TRUE WHERE id = $1`, [post.id]);
      archived++;
    } else {
      await withTransaction((client) => deletePostCascade(post.id, client));
      deleted++;
    }
  }

  return { archived, deleted };
}
