ALTER TABLE posts ADD COLUMN IF NOT EXISTS badge_type TEXT CHECK (badge_type IN ('trophy', 'sparkle'));
ALTER TABLE comments ADD COLUMN IF NOT EXISTS badge_type TEXT CHECK (badge_type IN ('trophy', 'sparkle'));
ALTER TABLE pruebas123_entries ADD COLUMN IF NOT EXISTS badge_type TEXT CHECK (badge_type IN ('trophy', 'sparkle'));

UPDATE posts SET badge_type = 'sparkle' WHERE verified = true AND badge_type IS NULL;
UPDATE comments SET badge_type = 'sparkle' WHERE verified = true AND badge_type IS NULL;
UPDATE pruebas123_entries SET badge_type = 'sparkle' WHERE verified = true AND badge_type IS NULL;
