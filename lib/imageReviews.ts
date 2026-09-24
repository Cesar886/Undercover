import { query, withTransaction } from './db';
import type { PoolClient } from 'pg';
import { emitFeed } from './events';

// Pending bytes live only here, never in the public posts/comments columns.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS image_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID UNIQUE REFERENCES comments(id) ON DELETE CASCADE,
  image_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CHECK ((post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int = 1),
  CHECK (status <> 'pending' OR image_data IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS image_reviews_pending_idx ON image_reviews (created_at, id) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS image_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
`;
let ready: Promise<void> | null = null;
export function ensureImageReviewSchema(): Promise<void> {
  if (!ready) ready = query(SCHEMA).then(() => {}).catch((error) => { ready = null; throw error; });
  return ready;
}

export async function queueImage(client: PoolClient, kind: 'post' | 'comment', id: string, image: string) {
  const column = kind === 'post' ? 'post_id' : 'comment_id';
  await client.query(`INSERT INTO image_reviews (${column}, image_data) VALUES ($1, $2)`, [id, image]);
}

export async function reviewImage(id: string, decision: 'approved' | 'rejected'): Promise<boolean> {
  await ensureImageReviewSchema();
  const outcome = await withTransaction(async (client) => {
    const result = await client.query('SELECT * FROM image_reviews WHERE id = $1 FOR UPDATE', [id]);
    const review = result.rows[0];
    if (!review || review.status !== 'pending') return null;
    let published = null;
    if (decision === 'approved') {
      // Deleted/hidden/archived content must not be resurrected by a late approval.
      const updated = review.post_id
        ? await client.query(
            `UPDATE posts SET image_webp = $1 WHERE id = $2 AND NOT is_hidden AND NOT archived
             AND NOT COALESCE((to_jsonb(posts)->>'owner_hidden')::boolean, FALSE) RETURNING *`,
            [review.image_data, review.post_id])
        : await client.query(
            `UPDATE comments c SET image_webp = $1 FROM posts p
             WHERE c.id = $2 AND p.id = c.post_id AND NOT COALESCE(c.is_deleted, FALSE)
               AND NOT COALESCE((to_jsonb(c)->>'is_hidden')::boolean, FALSE)
               AND NOT COALESCE((to_jsonb(c)->>'owner_hidden')::boolean, FALSE)
               AND NOT COALESCE((to_jsonb(p)->>'owner_hidden')::boolean, FALSE)
               AND NOT p.is_hidden AND NOT p.archived RETURNING c.*`,
            [review.image_data, review.comment_id]);
      published = updated.rows[0] ?? null;
    }
    const status = decision === 'approved' && published ? 'approved' : 'rejected';
    await client.query(
      'UPDATE image_reviews SET status = $2, image_data = NULL, reviewed_at = NOW() WHERE id = $1',
      [id, status]);
    return { published, kind: review.post_id ? 'post' : 'comment' };
  });
  if (!outcome) return false;
  if (outcome.published) {
    // Ownership tokens and private IPs must never be broadcast to other visitors.
    const { owner_token: _owner, poster_ip: _ip, ...safe } = outcome.published;
    if (outcome.kind === 'post') {
      emitFeed({ type: 'post:edited', post: safe });
    } else {
      emitFeed({ type: 'comment:edited', postId: safe.post_id, comment: safe });
    }
  }
  return true;
}
