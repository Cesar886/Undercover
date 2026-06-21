-- Polls attached to posts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS post_polls (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_poll_options (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id  UUID NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  label    TEXT NOT NULL,
  position INT  NOT NULL CHECK (position >= 0 AND position < 5),
  UNIQUE (poll_id, position)
);

CREATE TABLE IF NOT EXISTS post_poll_votes (
  poll_id    UUID        NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  option_id  UUID        NOT NULL REFERENCES post_poll_options(id) ON DELETE CASCADE,
  anon_id    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, anon_id)
);

CREATE INDEX IF NOT EXISTS idx_post_poll_options_poll_position
  ON post_poll_options (poll_id, position);

CREATE INDEX IF NOT EXISTS idx_post_poll_votes_option
  ON post_poll_votes (option_id);
