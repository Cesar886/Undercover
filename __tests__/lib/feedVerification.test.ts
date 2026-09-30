import { NextRequest, NextResponse } from 'next/server';
import { feedVerified, persistFeedVerification } from '@/lib/feedVerification';

const request = (cookie = '') => new NextRequest('http://localhost/api/posts', { headers: { cookie } });

it('activates for a whole word in the published text', () => {
  expect(feedVerified(request(), 'one', 'Hola, DEEPUM!')).toBe(true);
  expect(feedVerified(request(), 'one', 'deepum')).toBe(true);
  expect(feedVerified(request(), 'one', 'nodeepum123')).toBe(false);
  expect(feedVerified(request(), 'one', 'hola')).toBe(false);
});

it('persists verification across posts and comments, bound to the same identity', () => {
  process.env.ANON_SALT = 'verification-test-salt';
  const response = persistFeedVerification(NextResponse.json({}), 'one', true);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  expect(feedVerified(request(cookie), 'one', 'otro post')).toBe(true);
  expect(feedVerified(request(cookie), 'two', 'otro usuario')).toBe(false);
  expect(feedVerified(request('deepum_feed_verified=' + 'f'.repeat(64)), 'one', 'hola')).toBe(false);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
});

it('expires verification at Monday 05:00 in Monterrey', () => {
  process.env.ANON_SALT = 'verification-test-salt';
  jest.useFakeTimers().setSystemTime(new Date('2026-10-04T18:00:00Z'));
  const response = persistFeedVerification(NextResponse.json({}), 'one', true);
  const cookie = response.headers.get('set-cookie')!;
  const value = cookie.split(';')[0];
  expect(cookie).toContain('Expires=Mon, 05 Oct 2026 11:00:00 GMT');
  expect(feedVerified(request(value), 'one', 'otro post')).toBe(true);
  jest.setSystemTime(new Date('2026-10-05T11:00:01Z'));
  expect(feedVerified(request(value), 'one', 'otro post')).toBe(false);
  jest.useRealTimers();
});
