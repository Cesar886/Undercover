import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hasImageAdminSession } from '@/lib/imageAdmin';
import { isImageAdminOrigin } from '@/lib/imageAdminOrigin';
import { ensureViewsSchema } from '@/lib/views';

export const dynamic = 'force-dynamic';

const SORTS = new Set(['views', 'recent']);

export async function GET(request: NextRequest) {
  if (!await hasImageAdminSession()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!isImageAdminOrigin(request, { allowMissingOrigin: true })) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  await ensureViewsSchema();
  const sort = SORTS.has(request.nextUrl.searchParams.get('sort') ?? '')
    ? request.nextUrl.searchParams.get('sort')
    : 'views';
  const order = sort === 'recent'
    ? 'ORDER BY p.created_at DESC'
    : 'ORDER BY COALESCE(pv.views, 0) DESC, p.created_at DESC';

  const result = await query(`
    SELECT p.id, p.content, p.category, p.image_webp, p.created_at, COALESCE(pv.views, 0)::int AS views,
      COALESCE(
        json_agg(
          json_build_object(
            'id', c.id,
            'content', c.content,
            'created_at', c.created_at,
            'views', COALESCE(cv.views, 0)
          )
          ORDER BY COALESCE(cv.views, 0) DESC, c.created_at ASC
        ) FILTER (WHERE c.id IS NOT NULL),
        '[]'::json
      ) AS comments
    FROM posts p
    LEFT JOIN post_views pv ON pv.post_id = p.id
    LEFT JOIN comments c ON c.post_id = p.id AND c.is_hidden = false AND c.is_deleted = false
    LEFT JOIN comment_views cv ON cv.comment_id = c.id
    WHERE p.is_hidden = false
    GROUP BY p.id, pv.views
    ${order}
  `);

  return NextResponse.json({ posts: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
}
