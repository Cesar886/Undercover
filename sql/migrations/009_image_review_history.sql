ALTER TABLE image_reviews
  ADD COLUMN IF NOT EXISTS target_hidden_by_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE image_reviews DROP CONSTRAINT IF EXISTS image_reviews_status_check;
ALTER TABLE image_reviews ADD CONSTRAINT image_reviews_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'hidden'));
CREATE INDEX IF NOT EXISTS image_reviews_status_idx
  ON image_reviews (status, created_at DESC, id);
