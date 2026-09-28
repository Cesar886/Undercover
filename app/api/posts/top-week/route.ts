import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAnonId } from '@/lib/anon';
import { attachPollsToPosts } from '@/lib/polls';
import { ensureVisibilitySchema, ownerTokenFromRequest, publicOwnedRow } from '@/lib/visibility';
import type { Post } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await ensureVisibilitySchema();
    const ownerToken = ownerTokenFromRequest(request);
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const rawLimit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10);
    const limit = Math.min(30, Math.max(5, Number.isFinite(rawLimit) ? rawLimit : 10));
    const offset = (page - 1) * limit;

    const result = await query(
      `WITH weekly_posts AS (
         SELECT p.*, u.trust_score, u.trust_unlocked
         FROM posts p
         LEFT JOIN users u ON u.username = p.anon_id
         WHERE p.is_hidden = false
           AND p.archived = false
           AND p.created_at > NOW() - INTERVAL '7 days'
           AND (p.owner_hidden = false OR p.owner_token = $1::uuid)
           AND p.category != 'stickers'
       ),
       comment_stats AS (
         SELECT c.post_id, COUNT(*)::int AS comment_count
         FROM comments c
         JOIN weekly_posts wp ON wp.id = c.post_id
         WHERE c.is_hidden = false
           AND c.is_deleted = false
           AND (c.owner_hidden = false OR c.owner_token = $1::uuid)
         GROUP BY c.post_id
       ),
       post_reaction_stats AS (
         SELECT pr.post_id, COUNT(*)::int AS reaction_count
         FROM post_reactions pr
         JOIN weekly_posts wp ON wp.id = pr.post_id
         GROUP BY pr.post_id
       ),
       comment_reaction_stats AS (
         SELECT c.post_id, COUNT(*)::int AS reaction_count
         FROM comment_reactions cr
         JOIN comments c ON c.id = cr.comment_id
         JOIN weekly_posts wp ON wp.id = c.post_id
         WHERE c.is_hidden = false
           AND c.is_deleted = false
           AND (c.owner_hidden = false OR c.owner_token = $1::uuid)
         GROUP BY c.post_id
       ),
       ranked AS (
         SELECT
           wp.*,
           COALESCE(cs.comment_count, 0)::int AS comment_count,
           (COALESCE(prs.reaction_count, 0) + COALESCE(crs.reaction_count, 0))::int AS reaction_count,
           GREATEST(wp.upvotes - wp.downvotes, 0)::int AS net_votes,
           (
             COALESCE(cs.comment_count, 0) * 6 +
             GREATEST(wp.upvotes - wp.downvotes, 0) * 5 +
             (COALESCE(prs.reaction_count, 0) + COALESCE(crs.reaction_count, 0)) * 4 +
             CASE WHEN COALESCE(wp.last_bumped_at, wp.created_at) > NOW() - INTERVAL '24 hours' THEN 18 ELSE 0 END +
             CASE WHEN COALESCE(wp.last_bumped_at, wp.created_at) > NOW() - INTERVAL '3 days' THEN 8 ELSE 0 END
           )::int AS top_score
         FROM weekly_posts wp
         LEFT JOIN comment_stats cs ON cs.post_id = wp.id
         LEFT JOIN post_reaction_stats prs ON prs.post_id = wp.id
         LEFT JOIN comment_reaction_stats crs ON crs.post_id = wp.id
       )
       SELECT *
       FROM ranked
       WHERE top_score > 0 OR comment_count > 0 OR upvotes > 0 OR reaction_count > 0
       ORDER BY top_score DESC, comment_count DESC, reaction_count DESC, upvotes DESC, COALESCE(last_bumped_at, created_at) DESC
       LIMIT $2 OFFSET $3`,
      [ownerToken, limit, offset]
    );

    const safeRows = result.rows.map((row) => publicOwnedRow(row, ownerToken)) as unknown as Array<Post & {
      reaction_count: number;
      net_votes: number;
      top_score: number;
    }>;
    const viewerAnonId = ownerToken ? getAnonId(request).anonId : null;
    const posts = await attachPollsToPosts(safeRows, viewerAnonId);

    return NextResponse.json(
      { posts, page, limit, hasMore: result.rows.length === limit },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[GET /api/posts/top-week]', error);
    return NextResponse.json(
      { posts: [], page: 1, limit: 10, hasMore: false, databaseUnavailable: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
