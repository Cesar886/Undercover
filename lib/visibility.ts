import type { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const globalVisibility = globalThis as unknown as { __visibilitySchema?: Promise<void> };

export function ownerTokenFromRequest(request: NextRequest): string | null {
  const value = request.headers.get('x-owner-token')?.trim() ?? '';
  return UUID_RE.test(value) ? value : null;
}

export async function ensureVisibilitySchema(): Promise<void> {
  if (!globalVisibility.__visibilitySchema) {
    globalVisibility.__visibilitySchema = query(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS owner_token UUID;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS owner_token UUID;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_posts_owner_visibility ON posts (owner_token, owner_hidden);
      CREATE INDEX IF NOT EXISTS idx_comments_owner_visibility ON comments (post_id, owner_token, owner_hidden);
    `).then(() => undefined).catch((error) => {
      globalVisibility.__visibilitySchema = undefined;
      throw error;
    });
  }
  return globalVisibility.__visibilitySchema;
}

export function publicOwnedRow<T extends Record<string, unknown>>(row: T, viewerToken: string | null) {
  const { owner_token, ...safe } = row;
  return {
    ...safe,
    owner_hidden: Boolean(row.owner_hidden),
    is_owner: Boolean(viewerToken && owner_token === viewerToken),
  };
}
