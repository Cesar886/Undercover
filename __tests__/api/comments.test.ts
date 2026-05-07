jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: (name: string) =>
      name === 'session_user'
        ? { value: JSON.stringify({ id: 'u1', username: 'tester' }) }
        : undefined,
  })),
}));
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ ok: true, retryAfter: 0 }),
  RATE_LIMITS: { comments: { windowMs: 1000, max: 60 } },
}));

import { GET, POST } from '@/app/api/posts/[id]/comments/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const mockQuery = query as jest.Mock;
const POST_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => jest.clearAllMocks());

describe('GET /api/posts/[id]/comments', () => {
  const params = { id: POST_ID };

  it('returns comments array', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'c1', content: 'nice' }] });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/comments`);
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments).toHaveLength(1);
  });

  it('returns 400 for invalid post id', async () => {
    const req = new NextRequest('http://localhost/api/posts/abc/comments');
    const res = await GET(req, { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/posts/[id]/comments', () => {
  const params = { id: POST_ID };

  it('returns 400 for empty content', async () => {
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 when content exceeds 300 chars', async () => {
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'a'.repeat(301) }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid parent_id', async () => {
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hi', parent_id: 'not-a-uuid' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 201 with the new comment', async () => {
    const fakeComment = { id: 'c1', post_id: POST_ID, anon_id: 'tester', content: 'hello' };
    mockQuery.mockResolvedValue({ rows: [fakeComment] });
    const req = new NextRequest(`http://localhost/api/posts/${POST_ID}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.comment.content).toBe('hello');
  });
});
