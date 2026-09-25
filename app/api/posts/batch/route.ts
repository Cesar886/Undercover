import { getAnonId } from '@/lib/anon';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUsername, unauthorized } from '@/lib/auth';
import { attachPollsToPosts } from '@/lib/polls';
import { Post } from '@/types';
import { ensureVisibilitySchema, ownerTokenFromRequest, publicOwnedRow } from '@/lib/visibility';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  if (!(await getSessionUsername())) return unauthorized();
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);

  const raw = request.nextUrl.searchParams.get('ids') ?? '';
  const ids = raw.split(',').filter((id) => UUID_RE.test(id));

  if (ids.length === 0) return NextResponse.json({ posts: [] });

  const result = await query(
    `SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count
     FROM posts p
     WHERE p.id = ANY($1::uuid[]) AND p.is_hidden = false
       AND (p.owner_hidden = false OR p.owner_token = $2::uuid)
     ORDER BY p.created_at DESC`,
    [ids, ownerToken]
  );

  const viewerAnonId = ownerToken ? getAnonId(request).anonId : null;
  const safeRows = result.rows.map((row) => publicOwnedRow(row, ownerToken)) as unknown as Post[];
  const posts = await attachPollsToPosts(safeRows, viewerAnonId);

  return NextResponse.json({ posts }, { headers: { 'Cache-Control': 'private, no-store' } });
}
