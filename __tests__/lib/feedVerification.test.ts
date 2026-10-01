import { NextRequest, NextResponse } from 'next/server';
import { badgeTriggeredBy, feedBadge, feedVerified, persistFeedVerification } from '@/lib/feedVerification';

const request = (cookie = '') => new NextRequest('http://localhost/api/posts', { headers: { cookie } });

it('assigns each secret word its badge and requires a whole word', () => {
  expect(badgeTriggeredBy('Hola, DEEPUM!')).toBe('trophy');
  expect(badgeTriggeredBy('anonimo')).toBe('sparkle');
  expect(badgeTriggeredBy('AURA')).toBe('aura');
  expect(badgeTriggeredBy('an\u00f3nimo')).toBe('sparkle');
  expect(badgeTriggeredBy('anonimos')).toBeNull();
  expect(badgeTriggeredBy('auras')).toBeNull();
  expect(badgeTriggeredBy('nodeepum123')).toBeNull();
  expect(badgeTriggeredBy('deepum aura anonimo')).toBe('trophy');
  expect(feedVerified(request(), 'one', 'hola')).toBe(false);
});

it('persists the selected badge across posts and comments, bound to the same identity', () => {
  process.env.ANON_SALT = 'verification-test-salt';
  const response = persistFeedVerification(NextResponse.json({}), 'one', 'trophy');
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  expect(feedBadge(request(cookie), 'one', 'otro post')).toBe('trophy');
  expect(feedBadge(request(cookie), 'two', 'otro usuario')).toBeNull();
  expect(feedBadge(request('deepum_feed_verified=' + 'f'.repeat(64)), 'one', 'hola')).toBeNull();
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
});

it('expires the badge at Monday 05:00 in Monterrey', () => {
  process.env.ANON_SALT = 'verification-test-salt';
  jest.useFakeTimers().setSystemTime(new Date('2026-10-04T18:00:00Z'));
  const response = persistFeedVerification(NextResponse.json({}), 'one', 'sparkle');
  const cookie = response.headers.get('set-cookie')!;
  const value = cookie.split(';')[0];
  expect(cookie).toContain('Expires=Mon, 05 Oct 2026 11:00:00 GMT');
  expect(feedBadge(request(value), 'one', 'otro post')).toBe('sparkle');
  jest.setSystemTime(new Date('2026-10-05T11:00:01Z'));
  expect(feedBadge(request(value), 'one', 'otro post')).toBeNull();
  jest.useRealTimers();
});
