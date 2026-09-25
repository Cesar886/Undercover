import { NextRequest, NextResponse } from 'next/server';

function authorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get('x-admin-secret') === secret;
}

// IP bans are retired: a university network is shared by distinct people.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ error: 'Los bloqueos por IP están deshabilitados.' }, { status: 410 });
}
export const POST = GET;
export const DELETE = GET;
