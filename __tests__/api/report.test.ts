jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { POST } from '@/app/api/posts/[id]/report/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const mockQuery = query as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('POST /api/posts/[id]/report', () => {
  const params = { id: 'post-uuid-123' };

  it('returns 404 when post does not exist', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/report', {
      method: 'POST',
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated report count', async () => {
    mockQuery.mockResolvedValue({ rows: [{ report_count: 3, is_hidden: false }] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/report', {
      method: 'POST',
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report_count).toBe(3);
  });

  it('sets is_hidden when report_count reaches 10', async () => {
    mockQuery.mockResolvedValue({ rows: [{ report_count: 10, is_hidden: true }] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/report', {
      method: 'POST',
    });
    const res = await POST(req, { params });
    const body = await res.json();
    expect(body.is_hidden).toBe(true);
  });
});
