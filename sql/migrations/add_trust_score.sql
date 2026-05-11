-- Columnas en users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trust_score      INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_unlocked   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_end   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_count INTEGER     NOT NULL DEFAULT 0;

-- milestone en posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS milestone_5_rewarded BOOLEAN NOT NULL DEFAULT false;

-- votos en comments
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS upvotes   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvotes INTEGER NOT NULL DEFAULT 0;

-- tabla nueva
CREATE TABLE IF NOT EXISTS comment_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID        NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  voter_token TEXT        NOT NULL,
  vote_type   TEXT        NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, voter_token)
);
