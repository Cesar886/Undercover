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
jest.mock('@/lib/reportAutoHide', () => ({
  evaluatePostAutoHideAfterReport: jest.fn().mockResolvedValue(false),
}));

import { POST } from '@/app/api/posts/[id]/report/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { evaluatePostAutoHideAfterReport } from '@/lib/reportAutoHide';

const mockQuery = query as jest.Mock;
const mockEvaluatePostAutoHideAfterReport = evaluatePostAutoHideAfterReport as jest.Mock;
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
      .mockResolvedValueOnce({ rows: [{ is_hidden: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ report_count: 3, is_hidden: false }] });
    const req = reqWithBody({ reason: 'spam' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report_count).toBe(3);
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect((mockQuery.mock.calls[1][0] as string)).toMatch(/INSERT INTO reports/);
    expect(mockEvaluatePostAutoHideAfterReport).toHaveBeenCalledWith(expect.anything(), POST_ID, expect.any(String));
  });

  it('sets is_hidden when weighted reports reach the auto-hide threshold', async () => {
    mockEvaluatePostAutoHideAfterReport.mockResolvedValueOnce(true);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ is_hidden: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ report_count: 10, is_hidden: true }] });
    const req = reqWithBody({ reason: 'spam' });
    const res = await POST(req, { params });
    const body = await res.json();
    expect(body.is_hidden).toBe(true);
  });
});
