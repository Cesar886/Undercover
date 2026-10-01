ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_badge_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_badge_type_check CHECK (badge_type IN ('trophy', 'sparkle', 'aura'));

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_badge_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_badge_type_check CHECK (badge_type IN ('trophy', 'sparkle', 'aura'));

ALTER TABLE pruebas123_entries DROP CONSTRAINT IF EXISTS pruebas123_entries_badge_type_check;
ALTER TABLE pruebas123_entries ADD CONSTRAINT pruebas123_entries_badge_type_check CHECK (badge_type IN ('trophy', 'sparkle', 'aura'));
