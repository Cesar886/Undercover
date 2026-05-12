jest.mock('@/lib/db', () => {
  const mockQuery = jest.fn();
  return {
    query: mockQuery,
    withTransaction: jest.fn().mockImplementation(
      async (fn: (client: { query: typeof mockQuery }) => unknown) => fn({ query: mockQuery })
    ),
  };
});
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ ok: true, retryAfter: 0 }),
  RATE_LIMITS: { reports: { windowMs: 1000, max: 20 } },
}));
jest.mock('@/lib/trust', () => ({
  applyTrustDelta: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/posts/[id]/report/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const mockQuery = query as jest.Mock;
const POST_ID = '11111111-1111-1111-1111-111111111111';

function reqWithBody(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/posts/${POST_ID}/report`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/posts/[id]/report', () => {
  const params = { id: POST_ID };

  it('returns 400 for invalid post id', async () => {
    const req = reqWithBody({ reason: 'spam' });
    const res = await POST(req, { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is missing', async () => {
    const req = reqWithBody({});
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is invalid', async () => {
    const req = reqWithBody({ reason: 'because' });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 404 when post does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const req = reqWithBody({ reason: 'spam' });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it('returns 200 and inserts a report row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ report_count: 3, is_hidden: false, anon_id: 'user1' }] })
      .mockResolvedValueOnce({ rows: [] });
    const req = reqWithBody({ reason: 'spam' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report_count).toBe(3);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect((mockQuery.mock.calls[1][0] as string)).toMatch(/INSERT INTO reports/);
  });

  it('sets is_hidden when report_count reaches 10', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ report_count: 10, is_hidden: true, anon_id: 'user1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }); // reporters query
    const req = reqWithBody({ reason: 'spam' });
    const res = await POST(req, { params });
    const body = await res.json();
    expect(body.is_hidden).toBe(true);
  });
});
