import { threadAlias } from './publicIdentity';
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

// Explicit public contract. New database columns are private by default.
const PUBLIC_FIELDS = [
  'id', 'post_id', 'parent_id', 'content', 'category', 'upvotes', 'downvotes',
  'report_count', 'is_hidden', 'image_webp', 'created_at', 'updated_at',
  'last_bumped_at', 'archived', 'comment_count', 'is_deleted',
] as const;

export function publicOwnedRow<T extends Record<string, unknown>>(row: T, viewerToken: string | null): Record<string, unknown> & { owner_hidden: boolean; is_owner: boolean } {
  const safe: Record<string, unknown> = {};
  for (const field of PUBLIC_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, field)) safe[field] = row[field];
  }
  const threadId = row.post_id ?? row.id;
  // Fail closed for malformed records; legacy usernames are also pseudonymized.
  safe.anon_id = typeof row.anon_id === 'string' && typeof threadId === 'string'
    ? threadAlias(row.anon_id, threadId) : '';
  if (row.poll === null) safe.poll = null;
  else if (row.poll && typeof row.poll === 'object') {
    const poll = row.poll as Record<string, unknown>;
    safe.poll = {
      id: poll.id, post_id: poll.post_id, question: poll.question,
      total_votes: poll.total_votes, user_vote_option_id: poll.user_vote_option_id,
      options: Array.isArray(poll.options) ? poll.options.map(option => ({
        id: option.id, label: option.label, votes: option.votes, position: option.position,
      })) : [],
    };
  }
  return {
    ...safe,
    owner_hidden: Boolean(row.owner_hidden),
    is_owner: Boolean(viewerToken && row.owner_token === viewerToken),
  };
}
