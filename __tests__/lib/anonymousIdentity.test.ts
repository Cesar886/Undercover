jest.mock('@/lib/db', () => ({ query: jest.fn() }));
import { NextRequest } from 'next/server';
import { getAnonId } from '@/lib/anon';
import { getVoterKey, getReporterId } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS, _resetForTesting } from '@/lib/rateLimit';
import { middleware } from '@/middleware';
const first = '12345678-1234-4234-8234-123456789012';
const second = '12345678-1234-4234-8234-123456789013';
function request(id: string, ip = '192.0.2.1', cookie = 'same-old-cookie') {
  return new NextRequest('http://localhost/api/posts', { method: 'POST', headers: {
    'x-owner-token': id, 'x-real-ip': ip, 'x-forwarded-for': ip,
    cookie: `anon_token=${cookie}; anon_pub=old-public-id`,
  } });
}
beforeEach(() => { process.env.ANON_SALT = 'test-only'; _resetForTesting(); });
it('separates browser IDs sharing both IP and legacy cookies', async () => {
  expect(getAnonId(request(first))).not.toEqual(getAnonId(request(second)));
  expect(await getVoterKey(request(first))).not.toEqual(await getVoterKey(request(second)));
  expect(await getReporterId(request(first))).not.toEqual(await getReporterId(request(second)));
});
it('changing IP or cookies cannot reset the same browser identity', () => {
  expect(getAnonId(request(first))).toEqual(getAnonId(request(first, '203.0.113.4', 'new-cookie')));
});
it.each(['posts', 'comments', 'votes'] as const)('%s limits are independent on the same campus IP', kind => {
  const a = `${kind}:anon:${getAnonId(request(first)).anonId}`;
  const b = `${kind}:anon:${getAnonId(request(second)).anonId}`;
  for (let n = 0; n < RATE_LIMITS[kind].max; n++) expect(checkRateLimit(a, RATE_LIMITS[kind]).ok).toBe(true);
  expect(checkRateLimit(a, RATE_LIMITS[kind]).ok).toBe(false);
  expect(checkRateLimit(b, RATE_LIMITS[kind]).ok).toBe(true);
});
it('rejects absent/invalid identifiers instead of falling back to IP or cookie', () => {
  for (const id of ['', 'invalid']) {
    expect(() => getAnonId(request(id))).toThrow('Browser identifier');
    expect(middleware(request(id)).status).toBe(400);
  }
  expect(middleware(request(first)).status).toBe(200);
  expect(middleware(request(first)).headers.get('set-cookie')).toBeNull();
});
