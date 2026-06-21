import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUsername, unauthorized } from '@/lib/auth';
import { attachPollsToPosts } from '@/lib/polls';
import { Post } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  if (!(await getSessionUsername())) return unauthorized();

  const raw = request.nextUrl.searchParams.get('ids') ?? '';
  const ids = raw.split(',').filter((id) => UUID_RE.test(id));

  if (ids.length === 0) return NextResponse.json({ posts: [] });

  const result = await query(
    `SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count
     FROM posts p
     WHERE p.id = ANY($1::uuid[]) AND p.is_hidden = false
     ORDER BY p.created_at DESC`,
    [ids]
  );

  const viewerAnonId = request.cookies.get('anon_pub')?.value ?? null;
  const posts = await attachPollsToPosts(result.rows as Post[], viewerAnonId);

  return NextResponse.json({ posts });
}
