import { NextRequest, NextResponse } from 'next/server';
import { hasImageAdminSession } from '@/lib/imageAdmin';
import { query } from '@/lib/db';
import { ensureImageReviewSchema, reviewImage } from '@/lib/imageReviews';
import { isUuid } from '@/lib/validation';
import { isImageAdminOrigin } from '@/lib/imageAdminOrigin';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  await ensureImageReviewSchema();
  const rawPage = Number(new URL(request.url).searchParams.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 1000000) : 1;
  const result = await query(
    `SELECT r.id, r.created_at, CASE WHEN r.post_id IS NOT NULL THEN 'Publicación' ELSE 'Comentario' END AS kind,
       COALESCE(p.content, c.content, '') AS content
     FROM image_reviews r LEFT JOIN posts p ON p.id = r.post_id LEFT JOIN comments c ON c.id = r.comment_id
     WHERE r.status = 'pending' ORDER BY r.created_at, r.id LIMIT 25 OFFSET $1`, [(page - 1) * 24]);
  return NextResponse.json({ images: result.rows.slice(0, 24), hasMore: result.rows.length > 24 }, { headers });
}
export async function POST(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  if (!isImageAdminOrigin(request)) return NextResponse.json({ error: 'Origen inválido' }, { status: 403, headers });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers }); }
  if (!isUuid(body?.id) || !['approved', 'rejected'].includes(body?.decision)) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers });
  }
  const changed = await reviewImage(body.id, body.decision);
  return NextResponse.json(changed ? { ok: true } : { error: 'La imagen ya fue revisada o eliminada' }, { status: changed ? 200 : 409, headers });
}
