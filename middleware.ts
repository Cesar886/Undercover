import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function hasValidSession(request: NextRequest): boolean {
  const raw = request.cookies.get('session_user')?.value;
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.username === 'string' && parsed.username.trim().length > 0;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  if (!hasValidSession(request)) {
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
