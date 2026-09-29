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
