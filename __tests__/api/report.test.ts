jest.mock('@/lib/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  withTransaction: jest.fn(),
}));
jest.mock('@/lib/anon', () => ({ getAnonId: jest.fn(() => ({ anonId: 'reader' })) }));
jest.mock('@/lib/events', () => ({ emitFeed: jest.fn() }));
import { POST } from '@/app/api/posts/[id]/report/route';
import { POST as reportComment } from '@/app/api/posts/[id]/comments/[commentId]/report/route';
import { query, withTransaction } from '@/lib/db';
import { emitFeed } from '@/lib/events';
import { NextRequest } from 'next/server';
import { sanctionHours, communitySuspension } from '@/lib/communityModeration';
const id = '11111111-1111-1111-1111-111111111111';
const commentId = '22222222-2222-2222-2222-222222222222';
const client = { query: jest.fn() };
function req(body: unknown = { reason: 'spam' }) {
  return new NextRequest('http://localhost/api/report', { method: 'POST', body: JSON.stringify(body), headers: { 'x-real-ip': '192.0.2.1' } });
}
function setup({ duplicate = false, count = 0, hidden = false, author = 'author', missing = false, alreadyHidden = false, strikes = 3 } = {}) {
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id FROM posts')) return { rows: [{ id }] };
    if (sql.includes('SELECT anon_id')) return { rows: missing ? [] : [{ anon_id: author, is_hidden: alreadyHidden }] };
    if (sql.includes('SELECT 1 FROM community_reports')) return { rows: duplicate ? [{}] : [] };
    if (sql.includes('AS identity_count')) return { rows: [{ identity_count: count }] };
    if (sql.includes('RETURNING report_count')) return { rows: [{ report_count: hidden ? 5 : 1, is_hidden: hidden }] };
    if (sql.includes('RETURNING hidden_count')) return { rows: [{ hidden_count: strikes }] };
    return { rows: [] };
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  (query as jest.Mock).mockResolvedValue({ rows: [] });
  (withTransaction as jest.Mock).mockImplementation(fn => fn(client));
  setup();
});
it.each([3, 5, 10, 11])('escalates strike %i', count => {
  expect(sanctionHours(count)).toBe(count >= 10 ? 168 : count >= 5 ? 24 : 1);
});
it('does not suspend the first two strikes', () => { expect(sanctionHours(2)).toBe(0); });
it('validates the id and reason', async () => {
  expect((await POST(req(), { params: { id: 'bad' } })).status).toBe(400);
  expect((await POST(req({ reason: 'invalid' }), { params: { id } })).status).toBe(400);
  expect(withTransaction).not.toHaveBeenCalled();
});
it.each([
  [{ missing: true }, 404], [{ alreadyHidden: true }, 404], [{ author: 'reader' }, 403],
  [{ duplicate: true }, 409], [{ count: 10 }, 429],
])('rejects unavailable, self, duplicate and excessive reports (%j)', async (options, status) => {
  setup(options);
  expect((await POST(req(), { params: { id } })).status).toBe(status);
  expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO community_reports'))).toBe(false);
});
it('records a pending report without penalizing anyone', async () => {
  const response = await POST(req(), { params: { id } });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, report_count: 1, is_hidden: false });
  expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO community_sanctions'))).toBe(false);
  expect(emitFeed).not.toHaveBeenCalled();
});
it.each([['post', 3, 1], ['comment', 5, 24], ['post', 10, 168]] as const)('hides %s and applies strike %i atomically', async (kind, strikes, hours) => {
  setup({ hidden: true, strikes });
  const response = kind === 'post' ? await POST(req(), { params: { id } }) : await reportComment(req(), { params: { id, commentId } });
  expect((await response.json()).is_hidden).toBe(true);
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('GREATEST(suspended_until'), ['author', hours]);
  expect(emitFeed).toHaveBeenCalledWith(kind === 'post' ? { type: 'post:hidden', postId: id } : { type: 'comment:deleted', postId: id, commentId, soft: false });
});
it('blocks active suspensions and permits expired ones', async () => {
  (query as jest.Mock).mockResolvedValueOnce({ rows: [{ suspended_until: '2026-10-01' }] });
  expect((await communitySuspension('author'))?.status).toBe(403);
  expect(await communitySuspension('author')).toBeNull();
  expect(query).toHaveBeenCalledWith(expect.stringContaining('suspended_until > NOW()'), ['author']);
});
it('does not announce success when the transaction fails', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  (withTransaction as jest.Mock).mockRejectedValueOnce(new Error('rollback'));
  expect((await POST(req(), { params: { id } })).status).toBe(500);
  expect(emitFeed).not.toHaveBeenCalled();
  log.mockRestore();
});

it('rejects reports from suspended identities before opening a transaction', async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [{ suspended_until: '2026-10-01' }] });
  expect((await POST(req(), { params: { id } })).status).toBe(403);
  expect(withTransaction).not.toHaveBeenCalled();
});
it('rejects a comment report if its parent post is hidden or missing', async () => {
  client.query.mockResolvedValue({ rows: [] });
  expect((await reportComment(req(), { params: { id, commentId } })).status).toBe(404);
  expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO community_reports'))).toBe(false);
});
it('accepts reports without any IP headers', async () => {
  const request = new NextRequest('http://localhost/api/report', { method: 'POST', body: JSON.stringify({ reason: 'spam' }) });
  expect((await POST(request, { params: { id } })).status).toBe(200);
});
