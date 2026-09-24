import { query } from '@/lib/db';

export interface Category {
  slug: string;
  name: string;
  description: string;
  is_system: boolean;
  created_at?: string;
}

export const SYSTEM_CATEGORIES: Category[] = [
  { slug: 'general', name: 'General', description: 'Que esta pasando en la U', is_system: true },
  { slug: 'quemones', name: 'Quemones', description: 'Quememos a todos', is_system: true },
  { slug: 'infieles', name: 'Infieles', description: 'Entre todos nos cuidamos', is_system: true },
  { slug: 'confesiones', name: 'Confesiones', description: 'Lo que no le dirías a nadie en persona', is_system: true },
  { slug: 'stickers', name: 'Stickers', description: 'Tus mejores stickers aquí', is_system: true },
];

let schemaReady: Promise<void> | null = null;

export function ensureCategoriesSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
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
      `);

      for (const category of SYSTEM_CATEGORIES) {
        await query(
          `INSERT INTO categories (slug, name, description, is_system)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE`,
          [category.slug, category.name, category.description]
        );
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function listCategories(): Promise<Category[]> {
  await ensureCategoriesSchema();
  const result = await query(
    `SELECT slug, name, description, is_system, created_at
     FROM categories
     ORDER BY is_system DESC,
       CASE slug
         WHEN 'general' THEN 1 WHEN 'quemones' THEN 2 WHEN 'infieles' THEN 3
         WHEN 'confesiones' THEN 4 WHEN 'stickers' THEN 5 ELSE 99
       END,
       created_at ASC`
  );
  return result.rows as Category[];
}

export async function categoryExists(slug: string): Promise<boolean> {
  await ensureCategoriesSchema();
  const result = await query('SELECT 1 FROM categories WHERE slug = $1 LIMIT 1', [slug]);
  return result.rowCount === 1;
}

export function categorySlug(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
