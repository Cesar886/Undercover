import { NextRequest, NextResponse } from 'next/server';
import { checkImageAdminCredentials, createImageAdminSession, deleteImageAdminSession, IMAGE_ADMIN_COOKIE, IMAGE_ADMIN_COOKIE_OPTIONS } from '@/lib/imageAdmin';
import { checkRateLimit } from '@/lib/rateLimit';
import { getAnonId } from '@/lib/anon';
import { isImageAdminOrigin } from '@/lib/imageAdminOrigin';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (!isImageAdminOrigin(request)) return NextResponse.json({ error: 'Origen inválido' }, { status: 403 });
  const limit = checkRateLimit('image-admin-login:' + getAnonId(request).anonId, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }); }
  if (!await checkImageAdminCredentials(body?.username, body?.password)) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }
  const token = await createImageAdminSession();
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  response.cookies.set(IMAGE_ADMIN_COOKIE, token, IMAGE_ADMIN_COOKIE_OPTIONS);
  return response;
}
export async function DELETE(request: NextRequest) {
  if (!isImageAdminOrigin(request)) return NextResponse.json({ error: 'Origen inválido' }, { status: 403 });
  await deleteImageAdminSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(IMAGE_ADMIN_COOKIE, '', { ...IMAGE_ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
