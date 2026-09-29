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
         (COALESCE(r.image_data, p.image_webp, c.image_webp) IS NOT NULL) AS has_image,
         jsonb_strip_nulls(jsonb_build_object(
           'extracted_image_metadata', r.image_metadata,
           'review_id', r.id,
           'post_id', r.post_id,
           'comment_id', r.comment_id,
           'status', r.status,
           'target_hidden_by_review', r.target_hidden_by_review,
           'public_visible', r.public_visible,
           'review_created_at', r.created_at,
           'reviewed_at', r.reviewed_at,
           'source_type', CASE WHEN r.post_id IS NOT NULL THEN 'post' ELSE 'comment' END,
           'source_id', COALESCE(r.post_id, r.comment_id),
           'source_created_at', COALESCE(p.created_at, c.created_at),
           'source_updated_at', COALESCE(p.updated_at, c.updated_at),
           'source_category', p.category,
           'source_parent_id', c.parent_id,
           'source_post_id', c.post_id,
           'source_content_characters', length(COALESCE(p.content, c.content, '')),
           'source_upvotes', COALESCE(p.upvotes, c.upvotes),
           'source_downvotes', COALESCE(p.downvotes, c.downvotes),
           'source_report_count', COALESCE(p.report_count, c.report_count),
           'source_is_hidden', COALESCE(p.is_hidden, c.is_hidden),
           'source_owner_hidden', COALESCE(p.owner_hidden, c.owner_hidden),
           'source_archived', p.archived,
           'source_is_deleted', c.is_deleted,
           'source_is_seed', COALESCE(p.is_seed, c.is_seed),
           'stored_in_review', r.image_data IS NOT NULL,
           'published_on_source', COALESCE(p.image_webp, c.image_webp) IS NOT NULL,
           'image_mime', substring(COALESCE(r.image_data, p.image_webp, c.image_webp) from '^data:([^;]+);base64,'),
           'image_data_url_characters', CASE WHEN COALESCE(r.image_data, p.image_webp, c.image_webp) IS NULL THEN NULL ELSE length(COALESCE(r.image_data, p.image_webp, c.image_webp)) END,
           'image_base64_characters', CASE WHEN COALESCE(r.image_data, p.image_webp, c.image_webp) IS NULL THEN NULL ELSE length(split_part(COALESCE(r.image_data, p.image_webp, c.image_webp), ',', 2)) END,
           'image_bytes_approx', CASE WHEN COALESCE(r.image_data, p.image_webp, c.image_webp) IS NULL THEN NULL ELSE floor(length(split_part(COALESCE(r.image_data, p.image_webp, c.image_webp), ',', 2)) * 3 / 4)::int END,
           'review_image_mime', substring(r.image_data from '^data:([^;]+);base64,'),
           'review_image_bytes_approx', CASE WHEN r.image_data IS NULL THEN NULL ELSE floor(length(split_part(r.image_data, ',', 2)) * 3 / 4)::int END,
           'source_image_mime', substring(COALESCE(p.image_webp, c.image_webp) from '^data:([^;]+);base64,'),
           'source_image_bytes_approx', CASE WHEN COALESCE(p.image_webp, c.image_webp) IS NULL THEN NULL ELSE floor(length(split_part(COALESCE(p.image_webp, c.image_webp), ',', 2)) * 3 / 4)::int END
         )) AS metadata
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
  if (!changed) return NextResponse.json({ error: 'La imagen no está disponible' }, { status: 409, headers });
  const visibility = await query(`SELECT CASE WHEN r.post_id IS NOT NULL THEN
      p.image_webp IS NOT NULL AND NOT (p.is_hidden OR p.owner_hidden OR p.archived)
    ELSE c.image_webp IS NOT NULL AND NOT (c.is_hidden OR c.owner_hidden OR c.is_deleted
      OR parent.is_hidden OR parent.owner_hidden OR parent.archived) END AS public_visible
    FROM image_reviews r LEFT JOIN posts p ON p.id=r.post_id
    LEFT JOIN comments c ON c.id=r.comment_id LEFT JOIN posts parent ON parent.id=c.post_id
    WHERE r.id=$1`, [body.id]);
  return NextResponse.json({ ok: true, publicVisible: Boolean(visibility.rows[0]?.public_visible) }, { headers });
}

export async function DELETE(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  if (!isImageAdminOrigin(request)) return NextResponse.json({ error: 'Origen inválido' }, { status: 403, headers });
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers });
  const deleted = await deleteImageReview(id);
  return NextResponse.json(deleted ? { ok: true } : { error: 'La imagen no está disponible' }, { status: deleted ? 200 : 404, headers });
}
