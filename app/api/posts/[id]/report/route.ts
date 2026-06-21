import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { emitFeed } from '@/lib/events';
import { validateReportInput, isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { applyTrustDelta } from '@/lib/trust';
import { getReporterId } from '@/lib/auth';
import { applyBan } from '@/lib/ipban';

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

  const result = await withTransaction(async (client) => {
    const updateRes = await client.query(
      `UPDATE posts
       SET report_count = report_count + 1,
           is_hidden = CASE WHEN report_count + 1 >= 10 THEN true ELSE is_hidden END
       WHERE id = $1
       RETURNING report_count, is_hidden, anon_id, poster_ip`,
      [postId]
    );

    if (updateRes.rows.length === 0) return null;

    await client.query(
      `INSERT INTO reports (target_type, target_id, reason, detail, reporter_id)
       VALUES ('post', $1, $2, $3, $4)`,
      [postId, v.value.reason, v.value.detail ?? null, reporterId]
    );

    const { report_count, is_hidden, anon_id: postAuthor, poster_ip } = updateRes.rows[0];

    if (is_hidden && report_count >= 10) {
      const prevCount = report_count - 1;
      const justHidden = prevCount < 10;
      if (justHidden && postAuthor) {
        await applyTrustDelta(postAuthor, -15, client);

        // Auto-ban the poster's IP
        if (poster_ip) {
          await applyBan(poster_ip, `post con ${report_count} reportes`);
        }

        const reportersRes = await client.query<{ reporter_id: string }>(
          `SELECT DISTINCT reporter_id FROM reports
           WHERE target_type = 'post' AND target_id = $1
             AND reporter_id LIKE 'user:%'`,
          [postId]
        );
        for (const row of reportersRes.rows) {
          const reporterUsername = row.reporter_id.slice('user:'.length);
          if (reporterUsername) {
            await applyTrustDelta(reporterUsername, 3, client);
          }
        }
      }
    }

    return { report_count, is_hidden };
  });

  if (result === null) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  if (result.is_hidden) {
    emitFeed({ type: 'post:hidden', postId });
  }

  return NextResponse.json({ success: true, ...result });
}
