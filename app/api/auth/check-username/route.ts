import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitize } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  const username = sanitize(request.nextUrl.searchParams.get('username') ?? '').trim();

  if (username.length < 1 || username.length > 30) {
    return NextResponse.json({ available: false });
  }

  const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
  return NextResponse.json({ available: existing.rows.length === 0 });
}
