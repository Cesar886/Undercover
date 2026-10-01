import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { FeedBadge } from '@/lib/feedVerification';

const COOKIE = 'pruebas123_identity';
export interface TestIdentity { id: string; verified: boolean; badge: FeedBadge | null }
function sign(value: string) {
  const secret = process.env.ANON_SALT;
  if (!secret) throw new Error('ANON_SALT is required');
  return createHmac('sha256', secret).update('pruebas123:' + value).digest('hex');
}
export function testIdentity(request?: NextRequest): TestIdentity {
  const raw = request?.cookies.get(COOKIE)?.value;
  if (raw) {
    const [payload, signature] = raw.split('.');
    const expected = sign(payload);
    if (signature?.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      try {
        const value = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (typeof value.id === 'string' && typeof value.verified === 'boolean') {
          const badge = value.badge === 'trophy' || value.badge === 'sparkle' || value.badge === 'aura'
            ? value.badge : value.verified ? 'sparkle' : null;
          return { id: value.id, verified: Boolean(badge), badge };
        }
      } catch { /* Replace invalid cookies. */ }
    }
  }
  return { id: randomUUID(), verified: false, badge: null };
}
export function setTestIdentity(response: NextResponse, identity: TestIdentity) {
  const payload = Buffer.from(JSON.stringify(identity)).toString('base64url');
  response.cookies.set(COOKIE, payload + '.' + sign(payload), {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/api/pruebas123', maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
export function testAlias(identity: TestIdentity, thread: string) {
  return 'An\u00f3nimo ' + sign(identity.id + ':' + thread).slice(0, 8).toUpperCase();
}
