jest.mock('@/lib/imageAdmin', () => ({
  hasImageAdminSession: jest.fn(), checkImageAdminCredentials: jest.fn(), createImageAdminSession: jest.fn(),
  deleteImageAdminSession: jest.fn(), IMAGE_ADMIN_COOKIE: 'image_admin_session',
  IMAGE_ADMIN_COOKIE_OPTIONS: { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 28800 },
}));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/imageReviews', () => ({ ensureImageReviewSchema: jest.fn(), reviewImage: jest.fn(), deleteImageReview: jest.fn() }));
jest.mock('@/lib/ipban', () => ({ getRealIp: () => '127.0.0.1' }));

import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '@/app/api/image-admin/route';
import { GET as preview } from '@/app/api/image-admin/[id]/route';
import { POST as login, DELETE as logout } from '@/app/api/image-admin/session/route';
import { hasImageAdminSession, checkImageAdminCredentials, createImageAdminSession, deleteImageAdminSession } from '@/lib/imageAdmin';
import { query } from '@/lib/db';
import { deleteImageReview, reviewImage } from '@/lib/imageReviews';
import { _resetForTesting } from '@/lib/rateLimit';
import { isImageAdminOrigin } from '@/lib/imageAdminOrigin';

const ID = '12345678-1234-1234-1234-123456789012';
const req = (method = 'GET', body?: unknown, origin = 'http://localhost') => new NextRequest('http://localhost/api/image-admin', {
  method, headers: { 'Content-Type': 'application/json', origin }, ...(body ? { body: JSON.stringify(body) } : {}),
});
beforeEach(() => { jest.clearAllMocks(); _resetForTesting(); });

it('accepts the public HTTPS origin behind the production reverse proxy', () => {
  const request = new NextRequest('http://localhost:3000/api/image-admin', {
    headers: { host: 'example.com', origin: 'https://example.com', 'x-forwarded-proto': 'https' },
  });
  expect(isImageAdminOrigin(request)).toBe(true);
  request.headers.set('origin', 'https://other.example');
  expect(isImageAdminOrigin(request)).toBe(false);
});

it('requires authentication for queue, preview and decisions', async () => {
  (hasImageAdminSession as jest.Mock).mockResolvedValue(false);
  expect((await GET(req())).status).toBe(401);
  expect((await preview(req(), { params: { id: ID } })).status).toBe(401);
  expect((await POST(req('POST', { id: ID, decision: 'approved' }))).status).toBe(401);
  expect(query).not.toHaveBeenCalled();
  expect(reviewImage).not.toHaveBeenCalled();
});
it('rejects cross-origin decisions even with a session', async () => {
  (hasImageAdminSession as jest.Mock).mockResolvedValue(true);
  expect((await POST(req('POST', { id: ID, decision: 'approved' }, 'https://other.example'))).status).toBe(403);
  expect(reviewImage).not.toHaveBeenCalled();
});
it('serves previews privately from the moderation history', async () => {
  (hasImageAdminSession as jest.Mock).mockResolvedValue(true);
  (query as jest.Mock).mockResolvedValue({ rows: [{ image_data: 'data:image/webp;base64,aGVsbG8=' }] });
  const res = await preview(req(), { params: { id: ID } });
  expect(res.headers.get('cache-control')).toBe('private, no-store');
  expect(res.headers.get('content-type')).toBe('image/webp');
  expect(await res.text()).toBe('hello');
  expect((query as jest.Mock).mock.calls[0][0]).toContain('COALESCE(r.image_data');
});
it('accepts one-click decisions without a reason', async () => {
  (hasImageAdminSession as jest.Mock).mockResolvedValue(true);
  (reviewImage as jest.Mock).mockResolvedValue(true);
  expect((await POST(req('POST', { id: ID, decision: 'rejected' }))).status).toBe(200);
  expect(reviewImage).toHaveBeenCalledWith(ID, 'rejected');
});
it('does not create a session with incorrect credentials', async () => {
  (checkImageAdminCredentials as jest.Mock).mockResolvedValue(false);
  const res = await login(req('POST', { username: 'admin', password: 'wrong' }));
  expect(res.status).toBe(401);
  expect(createImageAdminSession).not.toHaveBeenCalled();
  expect(res.cookies.get('image_admin_session')).toBeUndefined();
});
it('sets a private expiring cookie after valid login', async () => {
  (checkImageAdminCredentials as jest.Mock).mockResolvedValue(true);
  (createImageAdminSession as jest.Mock).mockResolvedValue('random-session');
  const res = await login(req('POST', { username: 'admin', password: 'correct' }));
  expect(res.status).toBe(200);
  expect(res.cookies.get('image_admin_session')).toMatchObject({ value: 'random-session', httpOnly: true, sameSite: 'strict', maxAge: 28800 });
});
it('throttles repeated login attempts', async () => {
  (checkImageAdminCredentials as jest.Mock).mockResolvedValue(false);
  for (let i = 0; i < 5; i++) await login(req('POST', { username: 'admin', password: 'wrong' }));
  expect((await login(req('POST', { username: 'admin', password: 'wrong' }))).status).toBe(429);
});
it('revokes the session and removes its cookie on logout', async () => {
  const res = await logout(req('DELETE'));
  expect(deleteImageAdminSession).toHaveBeenCalled();
  expect(res.cookies.get('image_admin_session')?.maxAge).toBe(0);
});

it('permanently deletes a reviewed image only after an authenticated same-origin request', async () => {
  (hasImageAdminSession as jest.Mock).mockResolvedValue(true);
  (deleteImageReview as jest.Mock).mockResolvedValue(true);
  const request = new NextRequest('http://localhost/api/image-admin?id=' + ID, {
    method: 'DELETE', headers: { origin: 'http://localhost' },
  });
  const res = await DELETE(request);
  expect(res.status).toBe(200);
  expect(deleteImageReview).toHaveBeenCalledWith(ID);
});
