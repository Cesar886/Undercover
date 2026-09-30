jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/imageAdmin', () => ({ hasImageAdminSession: jest.fn() }));
jest.mock('@/lib/imageAdminOrigin', () => ({ isImageAdminOrigin: jest.fn() }));

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { hasImageAdminSession } from '@/lib/imageAdmin';
import { isImageAdminOrigin } from '@/lib/imageAdminOrigin';
import { POST as postView } from '@/app/api/posts/[id]/views/route';
import { POST as commentView } from '@/app/api/posts/[id]/comments/[commentId]/views/route';
import { GET as adminViews } from '@/app/api/image-admin/views/route';
import { middleware } from '@/middleware';
import { trackPostViewOnce } from '@/lib/viewTracking';

const id = '12345678-1234-4234-8234-123456789012';
const commentId = '12345678-1234-4234-8234-123456789013';
const req = (url = 'http://localhost/api/image-admin/views') => new NextRequest(url, {
  headers: { origin: 'http://localhost' },
});

beforeEach(() => {
  jest.clearAllMocks();
  (query as jest.Mock).mockResolvedValue({ rows: [{ post_id: id, comment_id: commentId }] });
  (hasImageAdminSession as jest.Mock).mockResolvedValue(true);
  (isImageAdminOrigin as jest.Mock).mockReturnValue(true);
});

it('public view endpoints only acknowledge writes without exposing counters', async () => {
  const postResponse = await postView(req(), { params: { id } });
  const commentResponse = await commentView(req(), { params: { id, commentId } });

  expect(postResponse.status).toBe(200);
  expect(commentResponse.status).toBe(200);
  expect(await postResponse.json()).toEqual({ ok: true });
  expect(await commentResponse.json()).toEqual({ ok: true });
});

it('protects admin view counts behind the image admin session', async () => {
  (hasImageAdminSession as jest.Mock).mockResolvedValue(false);
  const denied = await adminViews(req());
  expect(denied.status).toBe(401);

  (hasImageAdminSession as jest.Mock).mockResolvedValue(true);
  (query as jest.Mock).mockResolvedValue({ rows: [{ id, views: 7, comments: [] }] });
  const allowed = await adminViews(req());
  expect(allowed.status).toBe(200);
  expect(await allowed.json()).toEqual({ posts: [{ id, views: 7, comments: [] }] });
});

it('rejects cross-origin admin view reads', async () => {
  (isImageAdminOrigin as jest.Mock).mockReturnValue(false);
  const response = await adminViews(req('http://localhost/api/image-admin/views?sort=recent'));
  expect(response.status).toBe(403);
});

it('accepts the real client tracking request through middleware before writing the counter', async () => {
  const storage = new Map<string, string>();
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    crypto: { randomUUID: () => commentId },
  } });
  let responseStatus: number | undefined;
  globalThis.fetch = jest.fn(async (url, init) => {
    const request = new NextRequest(`http://localhost${url}`, init);
    const gate = middleware(request);
    const response = gate.headers.get('x-middleware-next') === '1'
      ? await postView(request, { params: { id } }) : gate;
    responseStatus = response.status;
    return response;
  });
  try {
    trackPostViewOnce(id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(responseStatus).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO post_views'), [id]);
    expect(storage.get(`quemadosum:viewed:post:${id}`)).toBeTruthy();
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
