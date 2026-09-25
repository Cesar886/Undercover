import { NextRequest, NextResponse } from 'next/server';
import { getAnonId } from '@/lib/anon';
import { ownerTokenFromRequest } from '@/lib/visibility';
import { threadAlias } from '@/lib/publicIdentity';
import { isUuid } from '@/lib/validation';

export function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!ownerTokenFromRequest(request)) return NextResponse.json({ error: 'Identificador requerido' }, { status: 400, headers });
  const threadId = request.nextUrl.searchParams.get('thread');
  if (threadId !== null && !isUuid(threadId)) {
    return NextResponse.json({ error: 'Hilo inválido' }, { status: 400, headers });
  }
  // No global pseudonym is exposed, even to its owner.
  const anonId = threadId ? threadAlias(getAnonId(request).anonId, threadId) : 'Anónimo';
  return NextResponse.json({ anonId }, { headers });
}
