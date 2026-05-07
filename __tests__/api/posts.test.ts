jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ ok: true, retryAfter: 0 }),
  RATE_LIMITS: { posts: { windowMs: 1000, max: 40 } },
}));

import { GET, POST } from '@/app/api/posts/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

const mockQuery = query as jest.Mock;
const mockRateLimit = checkRateLimit as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
});

describe('GET /api/posts', () => {
  it('returns posts array', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'abc', content: 'test' }] });
    const req = new NextRequest('http://localhost/api/posts');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toHaveLength(1);
  });

  it('filters by category when provided', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const req = new NextRequest('http://localhost/api/posts?category=quemones&page=2');
    await GET(req);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('$1');
    expect(params).toContain('quemones');
    expect(params).toContain(10); // offset for page 2
  });
});

describe('POST /api/posts', () => {
  it('returns 400 for empty content', async () => {
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '', category: 'rumores' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid category', async () => {
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'invalid' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for old category values', async () => {
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'chisme' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockReturnValueOnce({ ok: false, retryAfter: 30 });
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'rumores' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 201 and created post on success', async () => {
    const fakePost = { id: 'uuid', anon_id: 'Anónimo #1234', content: 'hello', category: 'quemones' };
    mockQuery.mockResolvedValue({ rows: [fakePost] });
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'quemones' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.post.id).toBe('uuid');
  });
});
