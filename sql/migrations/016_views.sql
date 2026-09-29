CREATE TABLE IF NOT EXISTS post_views (
  post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  views INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_views (
  comment_id UUID PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  views INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_views_post_id ON comment_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_views ON post_views(views DESC);
CREATE INDEX IF NOT EXISTS idx_comment_views_views ON comment_views(views DESC);
