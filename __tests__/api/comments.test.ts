jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { GET, POST } from '@/app/api/posts/[id]/comments/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const mockQuery = query as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('GET /api/posts/[id]/comments', () => {
  const params = { id: 'post-uuid-123' };

  it('returns comments array', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'c1', content: 'nice' }] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/comments');
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments).toHaveLength(1);
  });
});

describe('POST /api/posts/[id]/comments', () => {
  const params = { id: 'post-uuid-123' };

  it('returns 400 for empty content', async () => {
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 when content exceeds 300 chars', async () => {
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'a'.repeat(301) }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 201 with the new comment', async () => {
    const fakeComment = { id: 'c1', post_id: 'post-uuid-123', anon_id: 'Anónimo #5555', content: 'hello' };
    mockQuery.mockResolvedValue({ rows: [fakeComment] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/comments', {
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
