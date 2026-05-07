import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { emitFeed } from '@/lib/events';
import { validateReportInput, isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

function buildReporterKey(request: NextRequest, sessionRaw: string | undefined): string {
  if (sessionRaw) {
    try {
      const username = JSON.parse(sessionRaw).username;
      if (typeof username === 'string' && username.trim()) {
        return `user:${username.trim()}`;
      }
    } catch {
      // cae al IP
    }
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  return `ip:${ip}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  let sessionRaw: string | undefined;
  try {
    sessionRaw = (await cookies()).get('session_user')?.value;
  } catch {
    sessionRaw = undefined;
  }

  const reporterKey = buildReporterKey(request, sessionRaw);
  const rl = checkRateLimit(`reports:${reporterKey}`, RATE_LIMITS.reports);
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
    `UPDATE posts
     SET report_count = report_count + 1,
         is_hidden = CASE WHEN report_count + 1 >= 10 THEN true ELSE is_hidden END
     WHERE id = $1
     RETURNING report_count, is_hidden`,
    [params.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  if (result.rows[0].is_hidden) {
    emitFeed({ type: 'post:hidden', postId: params.id });
  }

  return NextResponse.json({ success: true, ...result.rows[0] });
}
