jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ ok: true, retryAfter: 0 }),
  RATE_LIMITS: { votes: { windowMs: 1000, max: 200 } },
}));

import { PATCH } from '@/app/api/posts/[id]/vote/route';
import { NextRequest } from 'next/server';
import { query, withTransaction } from '@/lib/db';

const mockQuery = query as jest.Mock;
const mockTx = withTransaction as jest.Mock;

const POST_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => { jest.clearAllMocks(); process.env.ANON_SALT = 'test-only'; });

describe('PATCH /api/posts/[id]/vote', () => {
  const params = { id: POST_ID };

  it('returns 400 for invalid vote_type', async () => {
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/vote`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-owner-token': '12345678-1234-4234-8234-123456789012' },
      body: JSON.stringify({ vote_type: 'sideways' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid post id', async () => {
    const req = new NextRequest('http://localhost/api/posts/abc/vote', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-owner-token': '12345678-1234-4234-8234-123456789012' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('keeps repeated votes idempotent without adding another vote', async () => {
    mockTx.mockImplementation(fn => fn({ query: mockQuery }));
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ rows: [{ vote_type: 'up' }] })
      .mockResolvedValueOnce({ rows: [{ anon_id: 'author' }] })
      .mockResolvedValueOnce({ rows: [{ upvotes: 5, downvotes: 1 }] });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/vote`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-owner-token': '12345678-1234-4234-8234-123456789012' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(200);
    expect((await res.json()).votes).toEqual({ upvotes: 5, downvotes: 1 });
    expect(mockQuery.mock.calls.some(([sql]) => /^\s*(INSERT|UPDATE)\b/.test(sql))).toBe(false);
  });

  it('returns 200 with updated vote counts on success', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockTx.mockResolvedValue({ votes: { upvotes: 5, downvotes: 1 }, postLikeNotif: null });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/vote`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-owner-token': '12345678-1234-4234-8234-123456789012' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.votes.upvotes).toBe(5);
  });
});
