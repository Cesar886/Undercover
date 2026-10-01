import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'deepum_feed_verified';
const TIMEZONE = 'America/Monterrey';
export type FeedBadge = 'trophy' | 'sparkle' | 'aura';

function monterreyWallClock(now: Date): Date {
  return new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

export function feedVerificationWindow(now = new Date()): { period: string; expiresAt: Date } {
  const wallNow = monterreyWallClock(now);
  const weekday = wallNow.getDay();
  const beforeCleanup = weekday === 1 && wallNow.getHours() < 5;
  const daysSinceMonday = (weekday - 1 + 7) % 7;
  const startWall = new Date(wallNow);
  startWall.setDate(wallNow.getDate() - daysSinceMonday - (beforeCleanup ? 7 : 0));
  startWall.setHours(5, 0, 0, 0);
  const endWall = new Date(startWall);
  endWall.setDate(startWall.getDate() + 7);
  const expiresAt = new Date(endWall.getTime() - wallNow.getTime() + now.getTime());
  const period = [startWall.getFullYear(), String(startWall.getMonth() + 1).padStart(2, '0'), String(startWall.getDate()).padStart(2, '0')].join('-');
  return { period, expiresAt };
}

export function badgeTriggeredBy(content: string): FeedBadge | null {
  if (/(?:^|[^\p{L}\p{N}_])deepum(?=$|[^\p{L}\p{N}_])/iu.test(content)) return 'trophy';
  if (/(?:^|[^\p{L}\p{N}_])aura(?=$|[^\p{L}\p{N}_])/iu.test(content)) return 'aura';
  if (/(?:^|[^\p{L}\p{N}_])an[o\u00f3]nimo(?=$|[^\p{L}\p{N}_])/iu.test(content)) return 'sparkle';
  return null;
}

function signature(anonId: string, period: string, badge: FeedBadge) {
  const secret = process.env.ANON_SALT;
  if (!secret) throw new Error('ANON_SALT is required');
  return createHmac('sha256', secret).update(`feed-badge-v3:${period}:${anonId}:${badge}`).digest('hex');
}

export function feedBadge(request: NextRequest, anonId: string, content: string): FeedBadge | null {
  const triggered = badgeTriggeredBy(content);
  if (triggered) return triggered;
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const [period, badge, supplied] = token.split('.');
  if (badge !== 'trophy' && badge !== 'sparkle' && badge !== 'aura') return null;
  const current = feedVerificationWindow().period;
  if (period !== current || !/^[0-9a-f]{64}$/.test(supplied ?? '')) return null;
  const expected = signature(anonId, current, badge);
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)) ? badge : null;
}

export function feedVerified(request: NextRequest, anonId: string, content: string): boolean {
  return feedBadge(request, anonId, content) !== null;
}

export function persistFeedVerification(response: NextResponse, anonId: string, badge: FeedBadge | null) {
  if (badge) {
    const { period, expiresAt } = feedVerificationWindow();
    response.cookies.set(COOKIE, `${period}.${badge}.${signature(anonId, period, badge)}`, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      path: '/api', expires: expiresAt,
    });
  }
  return response;
}
