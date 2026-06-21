import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpired } from '@/lib/ephemeral';

export const runtime = 'nodejs';

/**
 * Called hourly by Vercel cron (see vercel.json).
 * Vercel automatically adds Authorization: Bearer <CRON_SECRET>.
 * Can also be triggered manually: POST /api/cron/cleanup
 * with Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/cleanup] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const secretBuf = Buffer.from(expected);
  const authBuf = Buffer.from(auth);
  const valid =
    secretBuf.length === authBuf.length &&
    require('crypto').timingSafeEqual(secretBuf, authBuf);
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanupExpired();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/cleanup]', err);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}

// Vercel cron jobs use GET
export async function GET(request: NextRequest) {
  return POST(request);
}
