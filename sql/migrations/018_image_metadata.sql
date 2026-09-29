ALTER TABLE image_reviews
  ADD COLUMN IF NOT EXISTS image_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
