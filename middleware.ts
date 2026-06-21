import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ENC = new TextEncoder();

async function deriveAnonId(token: string): Promise<string | null> {
  const salt = process.env.ANON_SALT;
  if (!salt) return null; // refuse to derive without a real secret
  const data = ENC.encode(`${token}:${salt}`);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const COOKIE_OPTS = {
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
};

export async function middleware(request: NextRequest) {
  const token  = request.cookies.get('anon_token')?.value;
  const pubId  = request.cookies.get('anon_pub')?.value;

  // Both cookies present — nothing to do
  if (token && pubId) return NextResponse.next();

  const finalToken = token ?? crypto.randomUUID();
  const anonId     = await deriveAnonId(finalToken);

  // ANON_SALT not configured — skip cookie generation rather than use a weak fallback.
  // API routes in lib/anon.ts will throw explicitly when they are called.
  if (!anonId) return NextResponse.next();

  const response = NextResponse.next();

  if (!token) {
    response.cookies.set('anon_token', finalToken, { ...COOKIE_OPTS, httpOnly: true });
  }
  if (!pubId || pubId !== anonId) {
    response.cookies.set('anon_pub', anonId, { ...COOKIE_OPTS, httpOnly: false });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
