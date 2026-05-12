CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_username TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('post_like','post_comment','comment_reply','comment_like')),
  post_id UUID NOT NULL,
  comment_id UUID,
  actor_username TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_username, created_at DESC);
