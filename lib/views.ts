import { PoolClient } from 'pg';
import { query } from './db';

type Queryable = Pick<PoolClient, 'query'>;

export async function ensureViewsSchema(client?: Queryable) {
  const run = client?.query.bind(client) ?? query;
  await run(`
    CREATE TABLE IF NOT EXISTS post_views (
      post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
      views INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS comment_views (
      comment_id UUID PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      views INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run('CREATE INDEX IF NOT EXISTS idx_comment_views_post_id ON comment_views(post_id)');
  await run('CREATE INDEX IF NOT EXISTS idx_post_views_views ON post_views(views DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_comment_views_views ON comment_views(views DESC)');
}

export async function incrementPostView(postId: string) {
  await ensureViewsSchema();
  const result = await query(
    `INSERT INTO post_views (post_id, views)
     SELECT id, 1 FROM posts
     WHERE id = $1 AND is_hidden = false
     ON CONFLICT (post_id)
     DO UPDATE SET views = post_views.views + 1, updated_at = NOW()
     RETURNING post_id`,
    [postId]
  );
  return result.rows.length === 1;
}

export async function incrementCommentView(postId: string, commentId: string) {
  await ensureViewsSchema();
  const result = await query(
    `INSERT INTO comment_views (comment_id, post_id, views)
     SELECT c.id, c.post_id, 1
     FROM comments c
     JOIN posts p ON p.id = c.post_id
     WHERE c.id = $1 AND c.post_id = $2
       AND c.is_hidden = false
       AND c.is_deleted = false
       AND p.is_hidden = false
     ON CONFLICT (comment_id)
     DO UPDATE SET views = comment_views.views + 1, updated_at = NOW()
     RETURNING comment_id`,
    [commentId, postId]
  );
  return result.rows.length === 1;
}
