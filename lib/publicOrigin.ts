import type { NextRequest } from 'next/server';

function validHttpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function publicOrigin(request: NextRequest): string {
  const configured = validHttpOrigin(process.env.NEXT_PUBLIC_BASE_URL);
  if (configured) return configured;

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const host = forwardedHost || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
  const proxyOrigin = validHttpOrigin(host ? `${protocol}://${host}` : null);

  return proxyOrigin ?? request.nextUrl.origin;
}
