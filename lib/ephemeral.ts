import { PoolClient } from 'pg';
import { query, withTransaction } from './db';

export const MAX_THREADS_PER_CATEGORY = 150;
export const MAX_THREAD_AGE_DAYS      = 7;
export const MAX_INACTIVITY_DAYS      = 3;

async function expirePost(postId: string, client: PoolClient): Promise<void> {
  await client.query(
    `DELETE FROM comment_votes
     WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)`,
    [postId]
  );
  await client.query(`DELETE FROM votes         WHERE post_id = $1`, [postId]);
  await client.query(`DELETE FROM comments      WHERE post_id = $1`, [postId]);
  await client.query(`DELETE FROM notifications WHERE post_id = $1`, [postId]);
  await client.query(
    `UPDATE posts SET content = '', image_webp = NULL, archived = TRUE WHERE id = $1`,
    [postId]
  );
}

export async function pruneCategory(category: string, client: PoolClient): Promise<void> {
  const countRes = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM posts
     WHERE category = $1 AND archived = FALSE AND is_hidden = FALSE`,
    [category]
  );
  const count = parseInt(countRes.rows[0].n, 10);
  if (count <= MAX_THREADS_PER_CATEGORY) return;

  const oldest = await client.query<{ id: string }>(
    `SELECT id FROM posts
     WHERE category = $1 AND archived = FALSE AND is_hidden = FALSE
     ORDER BY last_bumped_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED`,
    [category]
  );
  if (oldest.rows.length === 0) return;

  await expirePost(oldest.rows[0].id, client);
}

export async function cleanupExpired(): Promise<{ expired: number }> {
  const rows = await query(
    `SELECT id FROM posts
     WHERE archived = FALSE AND is_hidden = FALSE
       AND (
         created_at     < NOW() - INTERVAL '${MAX_THREAD_AGE_DAYS} days'
         OR last_bumped_at < NOW() - INTERVAL '${MAX_INACTIVITY_DAYS} days'
       )`
  );

  for (const post of rows.rows as { id: string }[]) {
    await withTransaction((client) => expirePost(post.id, client));
  }

  return { expired: rows.rows.length };
}
