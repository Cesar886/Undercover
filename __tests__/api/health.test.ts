import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok' });
  });
  it('includes a timestamp', async () => {
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    const body = await res.json();
    expect(typeof body.timestamp).toBe('string');
  });
});
