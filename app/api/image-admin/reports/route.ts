import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hasImageAdminSession } from '@/lib/imageAdmin';
import { isImageAdminOrigin } from '@/lib/imageAdminOrigin';
import { ensureCommunitySchema } from '@/lib/communityModeration';
import { ensureAdminReportsSchema, normalizeAdminReportStatus, ADMIN_REPORT_STATUSES } from '@/lib/adminReports';
import { isUuid } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const SORTS = new Set(['count', 'recent']);

async function ensureSchemas() {
  await ensureCommunitySchema();
  await ensureAdminReportsSchema();
}

function parsePage(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get('page') || 1);
  return Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 1000000) : 1;
}

export async function GET(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  if (!isImageAdminOrigin(request, { allowMissingOrigin: true })) return NextResponse.json({ error: 'Origen inválido' }, { status: 403, headers });
  await ensureSchemas();

  const page = parsePage(request);
  const status = normalizeAdminReportStatus(request.nextUrl.searchParams.get('status'));
  const sort = SORTS.has(request.nextUrl.searchParams.get('sort') ?? '') ? request.nextUrl.searchParams.get('sort') : 'count';
  const order = sort === 'recent'
    ? 'ORDER BY grouped.latest_reported_at DESC, grouped.report_count DESC, grouped.target_id'
    : 'ORDER BY grouped.report_count DESC, grouped.latest_reported_at DESC, grouped.target_id';

  const [result, countResult] = await Promise.all([
    query(
      `WITH grouped AS (
        SELECT cr.target_type, cr.target_id,
          COUNT(*)::int AS report_count,
          MIN(cr.created_at) AS first_reported_at,
          MAX(cr.created_at) AS latest_reported_at,
          CASE
            WHEN BOOL_OR(cr.review_status = 'pending') THEN 'pending'
            WHEN BOOL_OR(cr.review_status = 'reviewed') THEN 'reviewed'
            ELSE 'dismissed'
          END AS review_status,
          MAX(cr.reviewed_at) AS reviewed_at,
          (ARRAY_AGG(cr.reason ORDER BY cr.created_at DESC))[1] AS reason,
          (ARRAY_AGG(cr.detail ORDER BY cr.created_at DESC) FILTER (WHERE cr.detail IS NOT NULL AND cr.detail <> ''))[1] AS detail
        FROM community_reports cr
        WHERE ($1::text = 'all' OR cr.review_status = $1)
        GROUP BY cr.target_type, cr.target_id
      )
      SELECT grouped.*,
        COALESCE(p.id, parent.id) AS post_id,
        COALESCE(p.content, c.content, '') AS content,
        COALESCE(p.image_webp, c.image_webp) AS image_webp,
        COALESCE(p.is_hidden, c.is_hidden, false) AS is_hidden,
        COALESCE(c.is_deleted, false) AS is_deleted,
        parent.is_hidden AS parent_hidden
      FROM grouped
      LEFT JOIN posts p ON grouped.target_type = 'post' AND p.id = grouped.target_id
      LEFT JOIN comments c ON grouped.target_type = 'comment' AND c.id = grouped.target_id
      LEFT JOIN posts parent ON parent.id = c.post_id
      ${order}
      LIMIT 25 OFFSET $2`,
      [status, (page - 1) * 24]
    ),
    query(`SELECT review_status, COUNT(*)::int AS count FROM community_reports GROUP BY review_status`),
  ]);

  const counts = { all: 0, pending: 0, reviewed: 0, dismissed: 0 };
  for (const row of countResult.rows) {
    if (row.review_status in counts) counts[row.review_status as keyof typeof counts] = Number(row.count);
    counts.all += Number(row.count);
  }

  const reports = result.rows.slice(0, 24).map((row) => ({
    target_type: row.target_type,
    target_id: row.target_id,
    post_id: row.post_id,
    reason: row.reason,
    detail: row.detail,
    report_count: row.report_count,
    first_reported_at: row.first_reported_at,
    latest_reported_at: row.latest_reported_at,
    review_status: row.review_status,
    reviewed_at: row.reviewed_at,
    content: row.content,
    image_webp: row.image_webp,
    is_hidden: row.is_hidden,
    is_deleted: row.is_deleted,
    parent_hidden: row.parent_hidden,
  }));

  return NextResponse.json({
    reports,
    hasMore: result.rows.length > 24,
    counts,
  }, { headers });
}

export async function POST(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  if (!isImageAdminOrigin(request)) return NextResponse.json({ error: 'Origen inválido' }, { status: 403, headers });
  await ensureSchemas();

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers }); }

  const payload = body as { target_type?: string; target_id?: string; action?: string };
  const status = payload.action === 'reviewed' ? 'reviewed' : payload.action === 'dismissed' ? 'dismissed' : null;
  if ((payload.target_type !== 'post' && payload.target_type !== 'comment') || !isUuid(payload.target_id) || !status) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers });
  }

  const result = await query(
    `UPDATE community_reports
     SET review_status = $3, reviewed_at = NOW()
     WHERE target_type = $1 AND target_id = $2
     RETURNING target_type, target_id`,
    [payload.target_type, payload.target_id, status]
  );

  if (!result.rows.length) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404, headers });
  return NextResponse.json({ ok: true, status }, { headers });
}

export async function PATCH(request: NextRequest) {
  if (!await hasImageAdminSession()) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers });
  if (!isImageAdminOrigin(request)) return NextResponse.json({ error: 'Origen inválido' }, { status: 403, headers });
  await ensureSchemas();

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers }); }
  const payload = body as { target_type?: string; target_id?: string };
  if ((payload.target_type !== 'post' && payload.target_type !== 'comment') || !isUuid(payload.target_id)) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers });
  }

  const table = payload.target_type === 'post' ? 'posts' : 'comments';
  const result = await query(`UPDATE ${table} SET is_hidden = true WHERE id = $1 RETURNING id`, [payload.target_id]);
  if (!result.rows.length) return NextResponse.json({ error: 'Contenido no encontrado' }, { status: 404, headers });
  await query(
    `UPDATE community_reports SET review_status = 'reviewed', reviewed_at = NOW()
     WHERE target_type = $1 AND target_id = $2`,
    [payload.target_type, payload.target_id]
  );
  return NextResponse.json({ ok: true }, { headers });
}
