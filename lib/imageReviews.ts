import { query, withTransaction } from './db';
import type { PoolClient } from 'pg';
import { emitFeed } from './events';

export type ImageReviewDecision = 'approved' | 'rejected' | 'hidden';

// Pending and reviewed bytes remain private here until an administrator deletes them.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS image_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID UNIQUE REFERENCES comments(id) ON DELETE CASCADE,
  image_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  target_hidden_by_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CHECK ((post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int = 1),
  CHECK (status <> 'pending' OR image_data IS NOT NULL)
);
ALTER TABLE image_reviews ADD COLUMN IF NOT EXISTS target_hidden_by_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE image_reviews DROP CONSTRAINT IF EXISTS image_reviews_status_check;
ALTER TABLE image_reviews ADD CONSTRAINT image_reviews_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'hidden'));
CREATE INDEX IF NOT EXISTS image_reviews_pending_idx ON image_reviews (created_at, id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS image_reviews_status_idx ON image_reviews (status, created_at DESC, id);
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

function publicRow(row: Record<string, unknown>) {
  const { owner_token: _owner, poster_ip: _ip, ...safe } = row;
  return safe;
}

export async function reviewImage(id: string, decision: ImageReviewDecision): Promise<boolean> {
  await ensureImageReviewSchema();
  const outcome = await withTransaction(async (client) => {
    const result = await client.query('SELECT * FROM image_reviews WHERE id = $1 FOR UPDATE', [id]);
    const review = result.rows[0];
    if (!review) return null;

    const kind = review.post_id ? 'post' as const : 'comment' as const;
    const targetId = review.post_id ?? review.comment_id;
    const targetResult = await client.query(
      kind === 'post'
        ? 'SELECT * FROM posts WHERE id = $1 FOR UPDATE'
        : 'SELECT * FROM comments WHERE id = $1 FOR UPDATE',
      [targetId]
    );
    const target = targetResult.rows[0] ?? null;
    const imageData = review.image_data ?? target?.image_webp ?? null;
    const wasHiddenByReview = Boolean(review.target_hidden_by_review);
    let changedTarget: Record<string, unknown> | null = null;
    let hiddenByReview = wasHiddenByReview;
    let restored = false;

    if (decision === 'approved') {
      if (!imageData || !target) return null;
      const updated = kind === 'post'
        ? await client.query(
            `UPDATE posts SET image_webp = $1,
               is_hidden = CASE WHEN $3::boolean THEN FALSE ELSE is_hidden END
             WHERE id = $2 AND NOT archived AND (NOT is_hidden OR $3::boolean) RETURNING *`,
            [imageData, targetId, wasHiddenByReview]
          )
        : await client.query(
            `UPDATE comments c SET image_webp = $1,
               is_deleted = CASE WHEN $3::boolean THEN FALSE ELSE c.is_deleted END
             FROM posts p WHERE c.id = $2 AND p.id = c.post_id
               AND (NOT COALESCE(c.is_deleted, FALSE) OR $3::boolean)
               AND NOT COALESCE((to_jsonb(c)->>'is_hidden')::boolean, FALSE)
               AND NOT COALESCE((to_jsonb(c)->>'owner_hidden')::boolean, FALSE)
               AND NOT COALESCE((to_jsonb(p)->>'owner_hidden')::boolean, FALSE)
               AND NOT p.is_hidden AND NOT p.archived RETURNING c.*`,
            [imageData, targetId, wasHiddenByReview]
          );
      changedTarget = updated.rows[0] ?? null;
      if (!changedTarget) return null;
      restored = wasHiddenByReview;
      hiddenByReview = false;
    } else if (target) {
      const imageOnly = !String(target.content ?? '').trim();
      if (kind === 'post') {
        const hideNow = imageOnly && !target.is_hidden && !target.archived;
        const updated = await client.query(
          `UPDATE posts SET image_webp = NULL,
             is_hidden = CASE WHEN $2::boolean THEN TRUE ELSE is_hidden END
           WHERE id = $1 RETURNING *`,
          [targetId, hideNow]
        );
        changedTarget = updated.rows[0] ?? null;
        hiddenByReview = wasHiddenByReview || hideNow;
      } else {
        const hideNow = imageOnly && !target.is_deleted;
        const updated = await client.query(
          `UPDATE comments SET image_webp = NULL,
             is_deleted = CASE WHEN $2::boolean THEN TRUE ELSE is_deleted END
           WHERE id = $1 RETURNING *`,
          [targetId, hideNow]
        );
        changedTarget = updated.rows[0] ?? null;
        hiddenByReview = wasHiddenByReview || hideNow;
      }
    }

    await client.query(
      `UPDATE image_reviews
       SET status = $2, image_data = COALESCE(image_data, $3),
           target_hidden_by_review = $4, reviewed_at = NOW()
       WHERE id = $1`,
      [id, decision, imageData, hiddenByReview]
    );

    return { kind, targetId, changedTarget, hiddenByReview, restored, decision };
  });

  if (!outcome) return false;
  if (outcome.changedTarget) {
    const safe = publicRow(outcome.changedTarget);
    if (outcome.kind === 'post') {
      if (outcome.decision !== 'approved' && outcome.hiddenByReview) {
        emitFeed({ type: 'post:hidden', postId: outcome.targetId });
      } else if (outcome.restored) {
        emitFeed({ type: 'post:new', post: safe as never });
      } else {
        emitFeed({ type: 'post:edited', post: safe as never });
      }
    } else if (outcome.decision !== 'approved' && outcome.hiddenByReview) {
      emitFeed({ type: 'comment:deleted', postId: String(safe.post_id), commentId: outcome.targetId, soft: true });
    } else if (outcome.restored) {
      emitFeed({ type: 'comment:new', postId: String(safe.post_id), comment: safe as never });
    } else {
      emitFeed({ type: 'comment:edited', postId: String(safe.post_id), comment: safe as never });
    }
  }
  return true;
}

export async function deleteImageReview(id: string): Promise<boolean> {
  await ensureImageReviewSchema();
  const outcome = await withTransaction(async (client) => {
    const result = await client.query('SELECT * FROM image_reviews WHERE id = $1 FOR UPDATE', [id]);
    const review = result.rows[0];
    if (!review) return null;

    const kind = review.post_id ? 'post' as const : 'comment' as const;
    const targetId = review.post_id ?? review.comment_id;
    const targetResult = await client.query(
      kind === 'post'
        ? 'SELECT * FROM posts WHERE id = $1 FOR UPDATE'
        : 'SELECT * FROM comments WHERE id = $1 FOR UPDATE',
      [targetId]
    );
    const target = targetResult.rows[0] ?? null;

    // Delete the private bytes first so a hard-deleted comment cannot remove the row unexpectedly via CASCADE.
    await client.query('DELETE FROM image_reviews WHERE id = $1', [id]);
    if (!target) return { kind, targetId, changedTarget: null, hard: false, hidden: false };

    const imageOnly = !String(target.content ?? '').trim();
    if (kind === 'post') {
      const updated = await client.query(
        `UPDATE posts SET image_webp = NULL,
           is_hidden = CASE WHEN $2::boolean THEN TRUE ELSE is_hidden END
         WHERE id = $1 RETURNING *`,
        [targetId, imageOnly]
      );
      return { kind, targetId, changedTarget: updated.rows[0] ?? null, hard: false, hidden: imageOnly };
    }

    if (imageOnly) {
      const replies = await client.query(
        'SELECT EXISTS(SELECT 1 FROM comments WHERE parent_id = $1) AS has_replies',
        [targetId]
      );
      const hasReplies = Boolean(replies.rows[0]?.has_replies);
      if (hasReplies) {
        const updated = await client.query(
          `UPDATE comments SET is_deleted = TRUE, content = '', image_webp = NULL WHERE id = $1 RETURNING *`,
          [targetId]
        );
        return { kind, targetId, changedTarget: updated.rows[0] ?? target, hard: false, hidden: true };
      }
      await client.query('DELETE FROM comments WHERE id = $1', [targetId]);
      return { kind, targetId, changedTarget: target, hard: true, hidden: true };
    }

    const updated = await client.query('UPDATE comments SET image_webp = NULL WHERE id = $1 RETURNING *', [targetId]);
    return { kind, targetId, changedTarget: updated.rows[0] ?? null, hard: false, hidden: false };
  });

  if (!outcome) return false;
  if (outcome.changedTarget) {
    const safe = publicRow(outcome.changedTarget);
    if (outcome.kind === 'post') {
      if (outcome.hidden) emitFeed({ type: 'post:hidden', postId: outcome.targetId });
      else emitFeed({ type: 'post:edited', post: safe as never });
    } else if (outcome.hidden) {
      emitFeed({ type: 'comment:deleted', postId: String(safe.post_id), commentId: outcome.targetId, soft: !outcome.hard });
    } else {
      emitFeed({ type: 'comment:edited', postId: String(safe.post_id), comment: safe as never });
    }
  }
  return true;
}
