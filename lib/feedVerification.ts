import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'deepum_feed_verified';
function signature(anonId: string) {
  const secret = process.env.ANON_SALT;
  if (!secret) throw new Error('ANON_SALT is required');
  return createHmac('sha256', secret).update('feed-verification-v1:' + anonId).digest('hex');
}
export function feedVerified(request: NextRequest, anonId: string, content: string): boolean {
  if (/(?:^|[^\p{L}\p{N}_])deepum(?=$|[^\p{L}\p{N}_])/iu.test(content)) return true;
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return false;
  const expected = signature(anonId);
  return token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
export function persistFeedVerification(response: NextResponse, anonId: string, verified: boolean) {
  if (verified) response.cookies.set(COOKIE, signature(anonId), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/api', maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
