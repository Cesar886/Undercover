ALTER TABLE posts ADD COLUMN IF NOT EXISTS owner_token UUID;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS owner_token UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_posts_owner_visibility
  ON posts (owner_token, owner_hidden);
CREATE INDEX IF NOT EXISTS idx_comments_owner_visibility
  ON comments (post_id, owner_token, owner_hidden);
