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

beforeEach(() => jest.clearAllMocks());

describe('PATCH /api/posts/[id]/vote', () => {
  const params = { id: POST_ID };

  it('returns 400 for invalid vote_type', async () => {
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/vote`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'sideways' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid post id', async () => {
    const req = new NextRequest('http://localhost/api/posts/abc/vote', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('returns 409 when voter has already voted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'existing-vote' }] });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/vote`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(409);
  });

  it('returns 200 with updated vote counts on success', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockTx.mockResolvedValue({ upvotes: 5, downvotes: 1 });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/vote`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.votes.upvotes).toBe(5);
  });
});
