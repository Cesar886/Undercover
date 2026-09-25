CREATE INDEX IF NOT EXISTS idx_posts_visible_recent
  ON posts (archived, last_bumped_at DESC, created_at DESC)
  WHERE is_hidden = false AND owner_hidden = false;

CREATE INDEX IF NOT EXISTS idx_posts_visible_category_recent
  ON posts (category, archived, last_bumped_at DESC, created_at DESC)
  WHERE is_hidden = false AND owner_hidden = false;

CREATE INDEX IF NOT EXISTS idx_posts_visible_top
  ON posts (archived, created_at DESC, upvotes DESC, downvotes ASC)
  WHERE is_hidden = false AND owner_hidden = false;

CREATE INDEX IF NOT EXISTS idx_comments_visible_post
  ON comments (post_id)
  WHERE is_hidden = false AND owner_hidden = false AND is_deleted = false;
