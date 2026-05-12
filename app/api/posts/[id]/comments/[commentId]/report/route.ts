import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateReportInput, isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { getReporterId } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  if (!isUuid(params.id) || !isUuid(params.commentId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const reporterId = await getReporterId(request);
  const rl = checkRateLimit(`reports:${reporterId}`, RATE_LIMITS.reports);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiados reportes. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  let body: unknown = null;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validateReportInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const result = await query(
    `UPDATE comments
     SET report_count = report_count + 1,
         is_hidden = CASE WHEN report_count + 1 >= 10 THEN true ELSE is_hidden END
     WHERE id = $1 AND post_id = $2
     RETURNING report_count, is_hidden`,
    [params.commentId, params.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
  }

  await query(
    `INSERT INTO reports (target_type, target_id, reason, detail, reporter_id)
     VALUES ('comment', $1, $2, $3, $4)`,
    [params.commentId, v.value.reason, v.value.detail ?? null, reporterId]
  );

  return NextResponse.json({ success: true, ...result.rows[0] });
}
