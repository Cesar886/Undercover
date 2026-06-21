-- Ephemeral threads: bump tracking and archive flag

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS last_bumped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS archived        BOOLEAN      NOT NULL DEFAULT FALSE;

-- Backfill: use created_at as initial bump time
UPDATE posts SET last_bumped_at = created_at WHERE last_bumped_at = NOW();

-- Prune query: find oldest thread in a category efficiently
CREATE INDEX IF NOT EXISTS idx_posts_category_bump
  ON posts (category, last_bumped_at ASC)
  WHERE archived = FALSE AND is_hidden = FALSE;

-- Archive listing: sorted by score
CREATE INDEX IF NOT EXISTS idx_posts_archived
  ON posts ((upvotes - downvotes) DESC)
  WHERE archived = TRUE AND is_hidden = FALSE;

-- Cron expiry query
CREATE INDEX IF NOT EXISTS idx_posts_expiry
  ON posts (created_at, last_bumped_at)
  WHERE archived = FALSE AND is_hidden = FALSE;
