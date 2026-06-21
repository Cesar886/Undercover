import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { emitFeed } from '@/lib/events';
import { validateReportInput, isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { getReporterId } from '@/lib/auth';
import { evaluatePostAutoHideAfterReport } from '@/lib/reportAutoHide';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

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

  const postId = params.id;

  try {
    const result = await withTransaction(async (client) => {
      const postRes = await client.query<{ is_hidden: boolean }>(
        `SELECT is_hidden
         FROM posts
         WHERE id = $1
         FOR UPDATE`,
        [postId]
      );

      if (postRes.rows.length === 0) return null;

      await client.query(
        `INSERT INTO reports (target_type, target_id, reason, detail, reporter_id)
         VALUES ('post', $1, $2, $3, $4)`,
        [postId, v.value.reason, v.value.detail ?? null, reporterId]
      );

      const hiddenByReport = await evaluatePostAutoHideAfterReport(client, postId, reporterId);

      const finalRes = await client.query<{ report_count: number; is_hidden: boolean }>(
        `UPDATE posts
         SET report_count = (
           SELECT COUNT(DISTINCT reporter_id)::int
           FROM reports
           WHERE target_type = 'post'
             AND target_id = $1
         )
         WHERE id = $1
         RETURNING report_count, is_hidden`,
        [postId]
      );

      return { ...finalRes.rows[0], hiddenByReport };
    });

    if (result === null) {
      return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
    }

    if (result.hiddenByReport) {
      emitFeed({ type: 'post:hidden', postId });
    }

    return NextResponse.json({ success: true, report_count: result.report_count, is_hidden: result.is_hidden });
  } catch (error) {
    console.error('REPORT API ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
