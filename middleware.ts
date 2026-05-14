import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionValue } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const raw = request.cookies.get('session_user')?.value;
  const session = raw ? await verifySessionValue(raw) : null;

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === '/login' || pathname === '/completar-registro';

  if (session && isAuthPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    return NextResponse.redirect(homeUrl);
  }

  // Rutas protegidas que requieren sesión
  const isProtectedRoute = 
    pathname === '/' || 
    pathname.startsWith('/posts/') || 
    pathname === '/buscar' || 
    pathname === '/guardados' || 
    (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/'));

  if (!session && isProtectedRoute) {
    if (pathname.startsWith('/api/')) {
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
