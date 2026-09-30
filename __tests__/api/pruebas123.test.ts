jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/anon', () => ({ getAnonId: () => ({ anonId: 'tester' }) }));
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ ok: true, retryAfter: 0 }),
}));

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { GET, POST } from '@/app/api/pruebas123/route';

const mockQuery = query as jest.Mock;
const mockRateLimit = checkRateLimit as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [] });
  mockRateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
});

it('reads exclusively from the isolated pruebas123 table', async () => {
  mockQuery.mockImplementation(async (sql: string) => (
    sql.includes('SELECT id, content, created_at')
      ? { rows: [{ id: 'entry-1', content: 'solo aqui', created_at: '2026-09-30T00:00:00.000Z' }] }
      : { rows: [] }
  ));

  const response = await GET(new NextRequest('http://localhost/api/pruebas123'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ verified: false,
    entries: [{ id: 'entry-1', content: 'solo aqui', created_at: '2026-09-30T00:00:00.000Z' }],
  });
  expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('FROM posts'), expect.anything());
});

it('stores text only in pruebas123_entries', async () => {
  mockQuery.mockImplementation(async (sql: string) => (
    sql.includes('INSERT INTO pruebas123_entries')
      ? { rows: [{ id: 'entry-2', content: 'texto de prueba', created_at: '2026-09-30T00:00:00.000Z' }] }
      : { rows: [] }
  ));
  const request = new NextRequest('http://localhost/api/pruebas123', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '<b>texto de prueba</b>' }),
  });

  const response = await POST(request);
  const insert = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO pruebas123_entries'));

  expect(response.status).toBe(201);
  expect(insert?.[1]).toEqual(['texto de prueba', expect.any(String), null, expect.any(String), false]);
  expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO (posts|comments)/.test(String(sql)))).toBe(false);
});

it('rejects empty and oversized text', async () => {
  const empty = new NextRequest('http://localhost/api/pruebas123', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '   ' }),
  });
  const oversized = new NextRequest('http://localhost/api/pruebas123', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'x'.repeat(501) }),
  });

  expect((await POST(empty)).status).toBe(400);
  expect((await POST(oversized)).status).toBe(400);
});

it('applies a separate publication rate limit', async () => {
  mockRateLimit.mockReturnValueOnce({ ok: false, retryAfter: 30 });
  const request = new NextRequest('http://localhost/api/pruebas123', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'hola' }),
  });

  const response = await POST(request);
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('30');
});
