DO $$
DECLARE category_constraint TEXT;
BEGIN
  FOR category_constraint IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'posts'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE posts DROP CONSTRAINT %I', category_constraint);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS categories (
  slug VARCHAR(40) PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  description VARCHAR(120) NOT NULL DEFAULT '',
  creator_anon_id TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_idx ON categories (LOWER(name));

INSERT INTO categories (slug, name, description, is_system) VALUES
  ('general', 'General', 'Que esta pasando en la U', TRUE),
  ('quemones', 'Quemones', 'Quememos a todos', TRUE),
  ('infieles', 'Infieles', 'Entre todos nos cuidamos', TRUE),
  ('confesiones', 'Confesiones', 'Lo que no le dirías a nadie en persona', TRUE),
  ('stickers', 'Stickers', 'Tus mejores stickers aquí', TRUE)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;
