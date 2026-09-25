jest.mock('@/lib/communityModeration', () => ({ communitySuspension: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/db', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('@/lib/anon', () => ({ getAnonId: () => ({ anonId: 'author' }) }));
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
import { deleteImageReview, reviewImage } from '@/lib/imageReviews';

const ID = '12345678-1234-1234-1234-123456789012';
const IMAGE = 'data:image/webp;base64,cHJpdmF0ZQ==';
const client = { query: jest.fn() };
const request = (data: unknown) => new NextRequest('http://localhost/api/posts', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Token': '12345678-1234-4234-8234-123456789012' }, body: JSON.stringify(data),
});

beforeEach(() => {
  process.env.ANON_SALT = 'image-privacy-test';
  jest.clearAllMocks();
  (query as jest.Mock).mockResolvedValue({ rows: [{ archived: false }] });
  (withTransaction as jest.Mock).mockImplementation((fn) => fn(client));
  (validateAndConvertImage as jest.Mock).mockResolvedValue({ ok: true, webpDataUrl: IMAGE });
});

it.each(['post', 'comment'])('queues new %s images privately until manual admin approval', async (kind) => {
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
  expect(inserts.some(([sql, args]) => sql.includes('INSERT INTO ' + (kind === 'post' ? 'posts' : 'comments')) && args.includes(IMAGE))).toBe(false);
  expect(inserts.some(([sql, args]) => sql.includes('INSERT INTO image_reviews') && args[1] === IMAGE)).toBe(true);
  expect(inserts.some(([sql]) => sql.includes("SET status = 'approved'"))).toBe(false);
});

it('rejects invalid image data before any insertion', async () => {
  (validateAndConvertImage as jest.Mock).mockResolvedValue({ ok: false, error: 'Imagen inválida' });
  const res = await createPost(request({ content: 'hi', category: 'general', image: 'bad' }));
  expect(res.status).toBe(400);
  expect(withTransaction).not.toHaveBeenCalled();
});

it.each(['post', 'comment'])('approval publishes and preserves the private %s image', async (kind) => {
  const target = kind === 'post'
    ? { id: ID, content: 'hello', image_webp: null, is_hidden: false, archived: false }
    : { id: ID, post_id: ID, content: 'hello', image_webp: null, is_deleted: false };
  const published = { ...target, image_webp: IMAGE, anon_id: 'private-image-author', poster_ip: '192.0.2.8', owner_token: 'private-owner-token', future_secret: 'private-future-field' };
  client.query
    .mockResolvedValueOnce({ rows: [{ status: 'pending', post_id: kind === 'post' ? ID : null, comment_id: kind === 'comment' ? ID : null, image_data: IMAGE, target_hidden_by_review: false }] })
    .mockResolvedValueOnce({ rows: [target] })
    .mockResolvedValueOnce({ rows: [published] })
    .mockResolvedValueOnce({ rows: [] });

  expect(await reviewImage(ID, 'approved')).toBe(true);
  expect(client.query.mock.calls[2][1][0]).toBe(IMAGE);
  expect(client.query.mock.calls[3][0]).toContain('image_data = COALESCE(image_data');
  expect(client.query.mock.calls[3][1]).toEqual([ID, 'approved', IMAGE, false, true]);
  expect(emitFeed).toHaveBeenCalledWith(expect.objectContaining({ type: kind + ':edited' }));
  const events = JSON.stringify((emitFeed as jest.Mock).mock.calls);
  for (const secret of ['private-image-author', '192.0.2.8', 'private-owner-token', 'private-future-field']) expect(events).not.toContain(secret);
});

it('rejecting an image-only comment hides it without destroying its review', async () => {
  client.query
    .mockResolvedValueOnce({ rows: [{ status: 'pending', post_id: null, comment_id: ID, image_data: IMAGE, target_hidden_by_review: false }] })
    .mockResolvedValueOnce({ rows: [{ id: ID, post_id: ID, content: '', image_webp: null, is_deleted: false }] })
    .mockResolvedValueOnce({ rows: [{ id: ID, post_id: ID, content: '', image_webp: null, is_deleted: true }] })
    .mockResolvedValueOnce({ rows: [] });

  expect(await reviewImage(ID, 'rejected')).toBe(true);
  expect(client.query.mock.calls[2][0]).toContain('is_deleted');
  expect(client.query.mock.calls[3][1]).toEqual([ID, 'rejected', IMAGE, true, true]);
  expect(emitFeed).toHaveBeenCalledWith({ type: 'comment:deleted', postId: ID, commentId: ID, soft: true });
});

it('keeps comment text while removing a rejected attachment', async () => {
  const target = { id: ID, post_id: ID, content: 'Este texto sí permanece', image_webp: IMAGE, is_deleted: false };
  client.query
    .mockResolvedValueOnce({ rows: [{ status: 'approved', post_id: null, comment_id: ID, image_data: IMAGE, target_hidden_by_review: false }] })
    .mockResolvedValueOnce({ rows: [target] })
    .mockResolvedValueOnce({ rows: [{ ...target, image_webp: null }] })
    .mockResolvedValueOnce({ rows: [] });

  expect(await reviewImage(ID, 'rejected')).toBe(true);
  expect(client.query.mock.calls[3][1]).toEqual([ID, 'rejected', IMAGE, false, true]);
  expect(emitFeed).toHaveBeenCalledWith(expect.objectContaining({ type: 'comment:edited' }));
});

it('can approve again and restore a comment hidden by moderation', async () => {
  const target = { id: ID, post_id: ID, content: '', image_webp: null, is_deleted: true };
  client.query
    .mockResolvedValueOnce({ rows: [{ status: 'rejected', post_id: null, comment_id: ID, image_data: IMAGE, target_hidden_by_review: true }] })
    .mockResolvedValueOnce({ rows: [target] })
    .mockResolvedValueOnce({ rows: [{ ...target, image_webp: IMAGE, is_deleted: false }] })
    .mockResolvedValueOnce({ rows: [] });

  expect(await reviewImage(ID, 'approved')).toBe(true);
  expect(client.query.mock.calls[2][1]).toEqual([IMAGE, ID, true]);
  expect(client.query.mock.calls[3][1]).toEqual([ID, 'approved', IMAGE, false, true]);
  expect(emitFeed).toHaveBeenCalledWith(expect.objectContaining({ type: 'comment:new' }));
});

it('supports a reversible hidden status while retaining bytes', async () => {
  const target = { id: ID, content: 'texto', image_webp: IMAGE, is_hidden: false, archived: false };
  client.query
    .mockResolvedValueOnce({ rows: [{ status: 'approved', post_id: ID, comment_id: null, image_data: IMAGE, target_hidden_by_review: false }] })
    .mockResolvedValueOnce({ rows: [target] })
    .mockResolvedValueOnce({ rows: [{ ...target, image_webp: null }] })
    .mockResolvedValueOnce({ rows: [] });

  expect(await reviewImage(ID, 'hidden')).toBe(true);
  expect(client.query.mock.calls[3][1]).toEqual([ID, 'hidden', IMAGE, false, true]);
});

it('legacy delete hides the public attachment while retaining the private review', async () => {
  const target = { id: ID, post_id: ID, content: 'texto', image_webp: IMAGE, is_deleted: false };
  client.query
    .mockResolvedValueOnce({ rows: [{ id: ID, post_id: null, comment_id: ID, image_data: IMAGE }] })
    .mockResolvedValueOnce({ rows: [target] })
    .mockResolvedValueOnce({ rows: [{ ...target, image_webp: null }] })
    .mockResolvedValueOnce({ rows: [] });

  expect(await deleteImageReview(ID)).toBe(true);
  expect(client.query.mock.calls[2][0]).toContain('image_webp = NULL');
  expect(client.query.mock.calls[3][1][1]).toBe('hidden');
  expect(client.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM'))).toBe(false);
});
