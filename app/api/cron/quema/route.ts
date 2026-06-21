import { NextRequest, NextResponse } from 'next/server';
import { runQuema, isQuemaTime } from '@/lib/quema';
import { emitFeed } from '@/lib/events';
import crypto from 'crypto';

export const runtime = 'nodejs';

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isQuemaTime()) {
    return NextResponse.json({ skipped: true, reason: 'not quema time' });
  }

  try {
    const result = await runQuema();
    emitFeed({ type: 'quema:total' });
    console.log('[cron/quema] quema total:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/quema] error:', err);
    return NextResponse.json({ error: 'Quema failed' }, { status: 500 });
  }
}

export const GET  = handle;
export const POST = handle;
