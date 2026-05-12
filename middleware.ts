import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionValue } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const raw = request.cookies.get('session_user')?.value;
  const session = raw ? await verifySessionValue(raw) : null;

  if (!session) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/posts/:path*',
    '/buscar',
    '/guardados',
    '/api/posts/:path*',
    '/api/stream',
  ],
};
