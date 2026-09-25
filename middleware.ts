import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsIdentity = (path.startsWith('/api/posts') &&
    (request.method !== 'GET' || /\/(vote|reactions)$/.test(path))) ||
    (path === '/api/categories' && request.method === 'POST') ||
    (path === '/api/image-admin/session' && request.method === 'POST');
  if (needsIdentity && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.headers.get('x-owner-token')?.trim() ?? '')) {
    return NextResponse.json({ error: 'Identificador del navegador inválido o ausente' }, { status: 400 });
  }
  return NextResponse.next();
}
export const config = { matcher: ['/api/:path*'] };
