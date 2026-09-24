jest.mock('@/lib/db', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('@/lib/anon', () => ({ getAnonId: () => ({ anonId: 'author' }), setAnonCookie: jest.fn() }));
jest.mock('@/lib/ipban', () => ({ getRealIp: () => '127.0.0.1', getBanStatus: async () => ({ banned: false }), banMessage: jest.fn() }));
jest.mock('@/lib/categories', () => ({ categoryExists: async () => true }));
jest.mock('@/lib/polls', () => ({ ensurePollSchema: async () => {}, getPollForPost: async () => null }));
jest.mock('@/lib/ephemeral', () => ({ pruneCategory: async () => {} }));
jest.mock('@/lib/imageValidation', () => ({ validateAndConvertImage: jest.fn() }));
jest.mock('@/lib/events', () => ({ emitFeed: jest.fn() }));

import { NextRequest } from 'next/server';
import { POST as createPost } from '@/app/api/posts/route';
import { POST as createComment } from '@/app/api/posts/[id]/comments/route';
import { query, withTransaction } from '@/lib/db';
import { validateAndConvertImage } from '@/lib/imageValidation';
import { emitFeed } from '@/lib/events';
import { reviewImage } from '@/lib/imageReviews';

const ID = '12345678-1234-1234-1234-123456789012';
const IMAGE = 'data:image/webp;base64,cHJpdmF0ZQ==';
const client = { query: jest.fn() };
const request = (data: unknown) => new NextRequest('http://localhost/api/posts', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Token': '12345678-1234-4234-8234-123456789012' }, body: JSON.stringify(data),
});
beforeEach(() => {
  jest.clearAllMocks();
  (query as jest.Mock).mockResolvedValue({ rows: [{ archived: false }] });
  (withTransaction as jest.Mock).mockImplementation((fn) => fn(client));
  (validateAndConvertImage as jest.Mock).mockResolvedValue({ ok: true, webpDataUrl: IMAGE });
});

it.each(['post', 'comment'])('queues %s bytes privately, never in public response or event', async (kind) => {
  const row = { id: ID, post_id: ID, content: 'hello', category: 'general', image_webp: null };
  client.query.mockResolvedValue({ rows: [row] });
  const req = request({ content: 'hello', category: 'general', image: IMAGE });
  const res = kind === 'post' ? await createPost(req) : await createComment(req, { params: { id: ID } });
  expect(res.status).toBe(201);
  const payload = await res.json();
  expect(payload.image_status).toBe('pending');
  expect(payload[kind].image_webp).toBeNull();
  expect(JSON.stringify(payload)).not.toContain(IMAGE);
  expect(JSON.stringify((emitFeed as jest.Mock).mock.calls)).not.toContain(IMAGE);
  const inserts = client.query.mock.calls;
  expect(inserts.some(([sql, args]) => sql.includes('INSERT INTO image_reviews') && args[1] === IMAGE)).toBe(true);
  const publicInsert = inserts.find(([sql]) => sql.includes('INSERT INTO ' + (kind === 'post' ? 'posts' : 'comments')));
  expect(publicInsert[1]).not.toContain(IMAGE);
});

it('rejects invalid image data before any insertion', async () => {
  (validateAndConvertImage as jest.Mock).mockResolvedValue({ ok: false, error: 'Imagen inválida' });
  const res = await createPost(request({ content: 'hi', category: 'general', image: 'bad' }));
  expect(res.status).toBe(400);
  expect(withTransaction).not.toHaveBeenCalled();
});

it.each(['post', 'comment'])('approval publishes only the selected pending %s image', async (kind) => {
  client.query.mockResolvedValueOnce({ rows: [{ id: ID, status: 'pending', post_id: kind === 'post' ? ID : null, comment_id: kind === 'comment' ? ID : null, image_data: IMAGE }] })
    .mockResolvedValueOnce({ rows: [{ id: ID, post_id: ID, image_webp: IMAGE }] })
    .mockResolvedValueOnce({ rows: [] });
  expect(await reviewImage(ID, 'approved')).toBe(true);
  expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
  expect(client.query.mock.calls[1][1]).toEqual([IMAGE, ID]);
  expect(client.query.mock.calls[2][1]).toEqual([ID, 'approved']);
  expect(client.query.mock.calls[2][0]).toContain('image_data = NULL');
  expect(emitFeed).toHaveBeenCalledWith(expect.objectContaining({ type: kind + ':edited' }));
});

it('rejection discards bytes without publishing anything', async () => {
  client.query.mockResolvedValueOnce({ rows: [{ status: 'pending', post_id: ID, image_data: IMAGE }] })
    .mockResolvedValueOnce({ rows: [] });
  expect(await reviewImage(ID, 'rejected')).toBe(true);
  expect(client.query).toHaveBeenCalledTimes(2);
  expect(client.query.mock.calls[1][1]).toEqual([ID, 'rejected']);
  expect(emitFeed).not.toHaveBeenCalled();
});

it('does not apply repeated or conflicting decisions to a completed review', async () => {
  client.query.mockResolvedValueOnce({ rows: [{ status: 'approved' }] });
  expect(await reviewImage(ID, 'rejected')).toBe(false);
  expect(client.query).toHaveBeenCalledTimes(1);
});

it('discards a pending image when its target has been deleted or hidden', async () => {
  client.query.mockResolvedValueOnce({ rows: [{ status: 'pending', post_id: ID, image_data: IMAGE }] })
    .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
  expect(await reviewImage(ID, 'approved')).toBe(true);
  expect(client.query.mock.calls[1][0]).toContain('NOT is_hidden');
  expect(client.query.mock.calls[2][1]).toEqual([ID, 'rejected']);
  expect(emitFeed).not.toHaveBeenCalled();
});
