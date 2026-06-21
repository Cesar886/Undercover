-- Add question field to polls and raise option limit to 6

ALTER TABLE post_polls ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '';

ALTER TABLE post_poll_options DROP CONSTRAINT IF EXISTS post_poll_options_position_check;
ALTER TABLE post_poll_options ADD CONSTRAINT post_poll_options_position_check
  CHECK (position >= 0 AND position < 6);
