import { apiGet, apiPost } from '@/lib/apiClient';

function mockFetch(impl: () => Promise<Response> | Response) {
  (global as any).fetch = jest.fn(impl);
}

afterEach(() => {
  delete (global as any).fetch;
});

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

describe('apiGet', () => {
  it('returns ok on 200', async () => {
    mockFetch(() => jsonResponse({ hello: 'world' }, { status: 200 }));
    const r = await apiGet<{ hello: string }>('/x');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.hello).toBe('world');
  });

  it('returns error with server message on 400', async () => {
    mockFetch(() => jsonResponse({ error: 'bad' }, { status: 400 }));
    const r = await apiGet('/x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('bad');
  });

  it('reads Retry-After on 429', async () => {
    mockFetch(() => jsonResponse({ error: 'rate' }, { status: 429, headers: { 'Retry-After': '12' } }));
    const r = await apiGet('/x');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/12/);
      expect(r.retryAfter).toBe(12);
    }
  });

  it('returns network error message when fetch throws', async () => {
    mockFetch(() => { throw new TypeError('fail'); });
    const r = await apiGet('/x');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/conexión/);
      expect(r.status).toBe(0);
    }
  });
});

describe('apiPost', () => {
  it('serializes body and returns parsed result', async () => {
    let receivedBody: string | null = null;
    mockFetch((input?: any, init?: any) => {
      receivedBody = init?.body ?? null;
      return jsonResponse({ ok: 1 }, { status: 201 });
    });
    const r = await apiPost('/x', { a: 1 });
    expect(r.ok).toBe(true);
    expect(receivedBody).toBe(JSON.stringify({ a: 1 }));
  });
});
