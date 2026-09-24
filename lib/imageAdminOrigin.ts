import type { NextRequest } from 'next/server';

export function isImageAdminOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    // ProxyPreserveHost retains the public host even when Next runs on localhost.
    const host = request.headers.get('host') ?? new URL(request.url).host;
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
      ?? new URL(request.url).protocol.replace(':', '');
    return new URL(origin).origin === protocol + '://' + host;
  } catch {
    return false;
  }
}
