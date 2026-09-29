ALTER TABLE community_reports
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'reviewed', 'dismissed'));

ALTER TABLE community_reports
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS community_reports_review_status_idx
  ON community_reports (review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS community_reports_target_created_idx
  ON community_reports (target_type, target_id, created_at DESC);
