import { NextRequest, NextResponse } from 'next/server';
import { hasImageAdminSession } from '@/lib/imageAdmin';
import { query } from '@/lib/db';
import { deleteImageReview, ensureImageReviewSchema, reviewImage } from '@/lib/imageReviews';
import { isUuid } from '@/lib/validation';
import { isImageAdminOrigin } from '@/lib/imageAdminOrigin';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;

export async function GET(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  await ensureImageReviewSchema();
  const url = new URL(request.url);
  const rawPage = Number(url.searchParams.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 1000000) : 1;
  const rawStatus = url.searchParams.get('status') ?? 'all';
  const status = rawStatus === 'all' || STATUSES.includes(rawStatus as typeof STATUSES[number]) ? rawStatus : 'all';

  const [result, countResult] = await Promise.all([
    query(
      `SELECT r.id, r.status, r.created_at, r.reviewed_at,
         CASE WHEN r.post_id IS NOT NULL THEN 'post' ELSE 'comment' END AS kind,
         COALESCE(p.content, c.content, '') AS content,
         (COALESCE(r.image_data, p.image_webp, c.image_webp) IS NOT NULL) AS has_image
       FROM image_reviews r
       LEFT JOIN posts p ON p.id = r.post_id
       LEFT JOIN comments c ON c.id = r.comment_id
       WHERE ($1::text = 'all' OR r.status = $1)
       ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC, r.id
       LIMIT 25 OFFSET $2`,
      [status, (page - 1) * 24]
    ),
    query(`SELECT status, COUNT(*)::int AS count FROM image_reviews GROUP BY status`),
  ]);

  const counts = { all: 0, pending: 0, approved: 0, rejected: 0, hidden: 0 };
  for (const row of countResult.rows) {
    if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.count);
    counts.all += Number(row.count);
  }

  return NextResponse.json({
    images: result.rows.slice(0, 24),
    hasMore: result.rows.length > 24,
    counts,
  }, { headers });
}

export async function POST(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  if (!isImageAdminOrigin(request)) return NextResponse.json({ error: 'Origen inválido' }, { status: 403, headers });
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers }); }
  if (!isUuid(body?.id) || !['approved', 'rejected', 'hidden'].includes(body?.decision)) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers });
  }
  const changed = await reviewImage(body.id, body.decision);
  return NextResponse.json(changed ? { ok: true } : { error: 'La imagen o su contenido ya no están disponibles' }, { status: changed ? 200 : 409, headers });
}

export async function DELETE(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  if (!isImageAdminOrigin(request)) return NextResponse.json({ error: 'Origen inválido' }, { status: 403, headers });
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers });
  const deleted = await deleteImageReview(id);
  return NextResponse.json(deleted ? { ok: true } : { error: 'La imagen ya fue eliminada' }, { status: deleted ? 200 : 404, headers });
}
