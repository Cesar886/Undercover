jest.mock('@/lib/db', () => ({ query: jest.fn() }));
import { publicOwnedRow } from '@/lib/visibility';
import { threadAlias } from '@/lib/publicIdentity';
import { anonDisplayName } from '@/lib/anonDisplay';
import { GET } from '@/app/api/identity/route';
import { NextRequest } from 'next/server';
import { getAnonId } from '@/lib/anon';

const thread = '12345678-1234-4234-8234-123456789012';
const otherThread = '12345678-1234-4234-8234-123456789013';
const owner = '12345678-1234-4234-8234-123456789014';
const internal = 'private-global-identity';
beforeEach(() => { process.env.ANON_SALT = 'privacy-test-secret'; });

it('keeps the alias within a thread and separates different threads and authors', () => {
  const post = publicOwnedRow({ id: thread, anon_id: internal }, null);
  const comment = publicOwnedRow({ id: 'comment', post_id: thread, anon_id: internal }, null);
  const reply = publicOwnedRow({ id: 'reply', post_id: thread, parent_id: 'comment', anon_id: internal }, null);
  expect(post.anon_id).toBe(comment.anon_id);
  expect(reply.anon_id).toBe(post.anon_id);
  expect(post.anon_id).not.toBe(internal);
  expect(post.anon_id).not.toBe(threadAlias(internal, otherThread));
  expect(post.anon_id).not.toBe(threadAlias('another-author', thread));
});

it('never returns raw IP, credentials, internal aliases or future database fields', () => {
  const result = publicOwnedRow({
    id: thread, anon_id: internal, content: 'hello', owner_token: owner,
    poster_ip: '192.0.2.10', email: 'private@example.com', google_id: 'google-secret',
    future_private_column: 'private', trust_score: 12, trust_unlocked: true,
    poll: { id: 'poll', anon_id: internal, options: [{ id: 'option', label: 'Yes', votes: 1, position: 0, voter: internal }] },
  }, owner);
  expect(result).toMatchObject({ id: thread, content: 'hello', is_owner: true, trust_score: 12, trust_unlocked: true });
  for (const key of ['owner_token', 'poster_ip', 'email', 'google_id', 'future_private_column']) {
    expect(result).not.toHaveProperty(key);
  }
  expect(JSON.stringify(result)).not.toContain(internal);
  expect(JSON.stringify(result)).not.toContain(owner);
  expect(publicOwnedRow({ id: thread, anon_id: internal, owner_token: owner }, null).is_owner).toBe(false);
});

it('pseudonymizes legacy usernames and does not display raw legacy identity', () => {
  expect(publicOwnedRow({ id: thread, anon_id: 'real.student.name' }, null).anon_id).toMatch(/^[a-f0-9]{64}$/);
  expect(anonDisplayName('real.student.name')).toBe('Anónimo');
});

it('fails closed without the secret', () => {
  delete process.env.ANON_SALT;
  expect(() => threadAlias(internal, thread)).toThrow('ANON_SALT');
});

it('returns only a scoped alias from the identity endpoint', async () => {
  const request = new NextRequest(`http://localhost/api/identity?thread=${thread}`, { headers: { 'x-owner-token': owner } });
  const response = GET(request);
  const body = await response.json();
  expect(body.anonId).toBe(threadAlias(getAnonId(request).anonId, thread));
  expect(body.anonId).not.toBe(getAnonId(request).anonId);
  expect(response.headers.get('cache-control')).toContain('no-store');
});

it('does not expose a global identity without a thread and rejects malformed scope', async () => {
  const headers = { 'x-owner-token': owner };
  expect(await GET(new NextRequest('http://localhost/api/identity', { headers })).json()).toEqual({ anonId: 'Anónimo' });
  expect(GET(new NextRequest('http://localhost/api/identity?thread=invalid', { headers })).status).toBe(400);
  expect(GET(new NextRequest(`http://localhost/api/identity?thread=${thread}`)).status).toBe(400);
});
