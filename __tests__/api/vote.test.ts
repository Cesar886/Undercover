jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

import { PATCH } from '@/app/api/posts/[id]/vote/route';
import { NextRequest } from 'next/server';
import { query, withTransaction } from '@/lib/db';

const mockQuery = query as jest.Mock;
const mockTx = withTransaction as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('PATCH /api/posts/[id]/vote', () => {
  const params = { id: 'post-uuid-123' };

  it('returns 400 for invalid vote_type', async () => {
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/vote', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'sideways' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 409 when voter has already voted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'existing-vote' }] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/vote', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(409);
  });

  it('returns 200 with updated vote counts on success', async () => {
    mockQuery.mockResolvedValue({ rows: [] }); // no existing vote
    mockTx.mockResolvedValue({ upvotes: 5, downvotes: 1 });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/vote', {
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
