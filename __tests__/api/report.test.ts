jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ ok: true, retryAfter: 0 }),
  RATE_LIMITS: { reports: { windowMs: 1000, max: 20 } },
}));

import { POST } from '@/app/api/posts/[id]/report/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const mockQuery = query as jest.Mock;
const POST_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => jest.clearAllMocks());

describe('POST /api/posts/[id]/report', () => {
  const params = { id: POST_ID };

  it('returns 400 for invalid post id', async () => {
    const req = new NextRequest('http://localhost/api/posts/abc/report', { method: 'POST' });
    const res = await POST(req, { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when post does not exist', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/report`, { method: 'POST' });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated report count', async () => {
    mockQuery.mockResolvedValue({ rows: [{ report_count: 3, is_hidden: false }] });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/report`, { method: 'POST' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report_count).toBe(3);
  });

  it('sets is_hidden when report_count reaches 10', async () => {
    mockQuery.mockResolvedValue({ rows: [{ report_count: 10, is_hidden: true }] });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/report`, { method: 'POST' });
    const res = await POST(req, { params });
    const body = await res.json();
    expect(body.is_hidden).toBe(true);
  });
});
