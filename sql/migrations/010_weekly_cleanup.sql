-- Images are independent, permanent records; retain source IDs for provenance.
ALTER TABLE image_reviews DROP CONSTRAINT IF EXISTS image_reviews_post_id_fkey;
ALTER TABLE image_reviews DROP CONSTRAINT IF EXISTS image_reviews_comment_id_fkey;
ALTER TABLE image_reviews ADD COLUMN IF NOT EXISTS public_visible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill legacy bytes before any source can be deleted.
INSERT INTO image_reviews(post_id, image_data, status, public_visible)
SELECT id, image_webp, 'approved', NOT (is_hidden OR owner_hidden OR archived)
FROM posts WHERE image_webp IS NOT NULL
ON CONFLICT (post_id) DO UPDATE SET image_data = COALESCE(image_reviews.image_data, EXCLUDED.image_data), public_visible = EXCLUDED.public_visible;
INSERT INTO image_reviews(comment_id, image_data, status, public_visible)
SELECT c.id, c.image_webp, 'approved', NOT (c.is_hidden OR c.owner_hidden OR c.is_deleted OR p.is_hidden OR p.owner_hidden OR p.archived)
FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.image_webp IS NOT NULL
ON CONFLICT (comment_id) DO UPDATE SET image_data = COALESCE(image_reviews.image_data, EXCLUDED.image_data), public_visible = EXCLUDED.public_visible;

-- Protect image bytes from ALL source deletion/edit paths, not only the cron.
CREATE OR REPLACE FUNCTION retain_source_image() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.image_webp IS NOT NULL THEN
    IF TG_TABLE_NAME = 'posts' THEN
      INSERT INTO image_reviews(post_id,image_data,status) VALUES(OLD.id,OLD.image_webp,'approved')
      ON CONFLICT(post_id) DO UPDATE SET image_data=COALESCE(image_reviews.image_data,EXCLUDED.image_data);
    ELSE
      INSERT INTO image_reviews(comment_id,image_data,status) VALUES(OLD.id,OLD.image_webp,'approved')
      ON CONFLICT(comment_id) DO UPDATE SET image_data=COALESCE(image_reviews.image_data,EXCLUDED.image_data);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER retain_post_image BEFORE DELETE OR UPDATE OF image_webp ON posts FOR EACH ROW EXECUTE FUNCTION retain_source_image();
CREATE TRIGGER retain_comment_image BEFORE DELETE OR UPDATE OF image_webp ON comments FOR EACH ROW EXECUTE FUNCTION retain_source_image();
CREATE OR REPLACE FUNCTION protect_image_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN RAISE EXCEPTION 'Images are permanent'; END IF;
  IF OLD.image_data IS NOT NULL AND NEW.image_data IS DISTINCT FROM OLD.image_data THEN
    RAISE EXCEPTION 'Stored image bytes are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_image_bytes BEFORE UPDATE OR DELETE ON image_reviews FOR EACH ROW EXECUTE FUNCTION protect_image_archive();
CREATE TRIGGER protect_image_truncate BEFORE TRUNCATE ON image_reviews FOR EACH STATEMENT EXECUTE FUNCTION protect_image_archive();

CREATE TABLE weekly_cleanup_backups (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '21 days'),
 payload JSONB NOT NULL
);
CREATE TABLE weekly_cleanup_runs (
 id UUID PRIMARY KEY, started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 local_date TEXT NOT NULL, status TEXT NOT NULL, backup_id UUID,
 counts JSONB NOT NULL DEFAULT '{}', error TEXT
);
CREATE UNIQUE INDEX weekly_cleanup_once ON weekly_cleanup_runs(local_date) WHERE status='success';
