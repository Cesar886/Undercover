jest.mock('@/lib/db', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('@/lib/polls', () => ({
  attachPollsToPosts: async (rows: unknown[]) => rows,
  getPollForPost: async () => null, ensurePollSchema: async () => {},
}));
jest.mock('@/lib/categories', () => ({ categoryExists: async () => true }));
jest.mock('@/lib/ephemeral', () => ({ pruneCategory: async () => {} }));
jest.mock('@/lib/communityModeration', () => ({ communitySuspension: async () => null }));
jest.mock('@/lib/auth', () => ({ getSessionUsername: async () => 'viewer' }));
jest.mock('@/lib/events', () => ({ emitFeed: jest.fn() }));
import { NextRequest } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { GET as list, POST as create } from '@/app/api/posts/route';
import { GET as detail, PATCH as edit } from '@/app/api/posts/[id]/route';
import { GET as batch } from '@/app/api/posts/batch/route';
import { GET as comments, POST as addComment } from '@/app/api/posts/[id]/comments/route';
import { PATCH as editComment } from '@/app/api/posts/[id]/comments/[commentId]/route';
import { PATCH as visibility } from '@/app/api/posts/[id]/visibility/route';
import { PATCH as commentVisibility } from '@/app/api/posts/[id]/comments/[commentId]/visibility/route';
import { getAnonId } from '@/lib/anon';
import { threadAlias } from '@/lib/publicIdentity';
import { emitFeed } from '@/lib/events';
import { _resetForTesting } from '@/lib/rateLimit';

const id = '12345678-1234-4234-8234-123456789012';
const commentId = '12345678-1234-4234-8234-123456789013';
const token = '12345678-1234-4234-8234-123456789014';
function req(method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost/api/posts?ids=${id}`, {
    method, headers: { 'x-owner-token': token, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
let raw: Record<string, unknown>;
let internal: string;
beforeEach(() => {
  jest.clearAllMocks(); _resetForTesting();
  process.env.ANON_SALT = 'privacy-integration-test';
  internal = getAnonId(req()).anonId;
  raw = { id, anon_id: internal, owner_token: token, poster_ip: '192.0.2.9',
    content: 'hello', category: 'general', owner_hidden: false, is_hidden: false,
    archived: false, is_deleted: false, email: 'private@example.com', future_secret: 'secret' };
  (globalThis as unknown as { __visibilitySchema: Promise<void> }).__visibilitySchema = Promise.resolve();
  (query as jest.Mock).mockImplementation(async (sql: string) => ({ rows: [
    sql.includes('comments') && !sql.includes('SELECT p.*')
      ? { ...raw, id: commentId, post_id: id } : raw,
  ] }));
  (withTransaction as jest.Mock).mockImplementation(fn => fn({ query }));
});
function check(value: unknown) {
  const json = JSON.stringify(value);
  for (const privateValue of [internal, token, '192.0.2.9', 'private@example.com', 'future_secret', 'poster_ip', 'owner_token']) {
    expect(json).not.toContain(privateValue);
  }
}
it.each(['list', 'detail', 'batch', 'comments'])('protects the %s response using the real serializer', async (route) => {
  const response = route === 'list' ? await list(req()) : route === 'batch' ? await batch(req())
    : route === 'detail' ? await detail(req(), { params: { id } }) : await comments(req(), { params: { id } });
  expect(response.status).toBe(200);
  const body = await response.json(); check(body);
  const row = body.post ?? body.posts?.[0] ?? body.comments[0];
  expect(row.anon_id).toBe(threadAlias(internal, id));
  expect(row.is_owner).toBe(true);
});
it.each(['create', 'edit', 'comment', 'editComment', 'visibility', 'commentVisibility'])('protects %s responses and emitted events', async (route) => {
  const body = { content: 'hello', category: 'general', hidden: false };
  const response = route === 'create' ? await create(req('POST', body))
    : route === 'edit' ? await edit(req('PATCH', body), { params: { id } })
    : route === 'comment' ? await addComment(req('POST', body), { params: { id } })
    : route === 'editComment' ? await editComment(req('PATCH', body), { params: { id, commentId } })
    : route === 'visibility' ? await visibility(req('PATCH', body), { params: { id } })
    : await commentVisibility(req('PATCH', body), { params: { id, commentId } });
  expect(response.status).toBe(route === 'create' || route === 'comment' ? 201 : 200);
  const payload = await response.json(); check(payload);
  expect((payload.post ?? payload.comment).anon_id).toBe(threadAlias(internal, id));
  expect((payload.post ?? payload.comment).is_owner).toBe(true);
  check((emitFeed as jest.Mock).mock.calls);
});
it('still rejects editing another author’s post', async () => {
  raw.anon_id = 'other-author';
  const response = await edit(req('PATCH', { content: 'changed' }), { params: { id } });
  expect(response.status).toBe(403);
  expect(emitFeed).not.toHaveBeenCalled();
});
it('does not broadcast edits of privately hidden posts', async () => {
  raw.owner_hidden = true;
  const response = await edit(req('PATCH', { content: 'changed' }), { params: { id } });
  expect(response.status).toBe(200);
  expect(emitFeed).not.toHaveBeenCalled();
});
