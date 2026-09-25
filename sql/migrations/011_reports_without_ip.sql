-- Stop recording network identifiers without deleting historical report data.
-- NULL values do not conflict with the legacy unique network constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_reports'
      AND column_name = 'network_key'
  ) THEN
    ALTER TABLE public.community_reports ALTER COLUMN network_key DROP NOT NULL;
    ALTER TABLE public.community_reports ALTER COLUMN network_key DROP DEFAULT;
  END IF;
END $$;
