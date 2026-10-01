jest.mock('@/lib/db', () => ({ query: jest.fn(async (sql: string, values?: unknown[]) => {
  if (sql.includes('INSERT INTO')) return { rows: [{ content: values![0], id: values![1], thread_id: values![2], alias: values![3], verified: values![4], badge_type: values![5] }] };
  return { rows: [{ id: 'parent' }] };
}) }));
jest.mock('@/lib/anon', () => ({ getAnonId: () => ({ anonId: 'test' }) }));
jest.mock('@/lib/rateLimit', () => ({ checkRateLimit: () => ({ ok: true }) }));
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/pruebas123/route';

const thread = '11111111-1111-4111-8111-111111111111';
function request(body: unknown, cookie = '') {
  return new NextRequest('http://localhost/api/pruebas123', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
}
it('keeps aliases per thread, verifies with the secret, and resets identity without a badge', async () => {
  const first = await POST(request({ content: 'primero', thread_id: thread, verified: true }));
  const cookie = first.headers.get('set-cookie')!.split(';')[0];
  const initial = (await first.json()).entry;
  expect(initial.verified).toBe(false);
  const same = await POST(request({ content: 'segundo', thread_id: thread }, cookie));
  expect((await same.json()).entry.alias).toBe(initial.alias);
  const other = await POST(request({ content: 'otro hilo' }, cookie));
  expect((await other.json()).entry.alias).not.toBe(initial.alias);
  const partial = await POST(request({ content: 'nodeepum123', thread_id: thread }, cookie));
  expect((await partial.json()).entry.verified).toBe(false);
  const sparklePlain = await POST(request({ content: 'anonimo', thread_id: thread }, cookie));
  expect((await sparklePlain.json()).entry).toMatchObject({ verified: true, badge_type: 'sparkle' });
  const sparkleAccent = await POST(request({ content: 'anónimo', thread_id: thread }, cookie));
  expect((await sparkleAccent.json()).entry).toMatchObject({ verified: true, badge_type: 'sparkle' });
  const verify = await POST(request({ content: 'Hola, deepum!', thread_id: thread }, cookie));
  expect((await verify.json()).entry).toMatchObject({ verified: true, badge_type: 'trophy', alias: initial.alias });
  const verifiedCookie = verify.headers.get('set-cookie')!.split(';')[0];
  const verified = await POST(request({ content: 'verificado', thread_id: thread }, verifiedCookie));
  expect((await verified.json()).entry).toMatchObject({ verified: true, badge_type: 'trophy', alias: initial.alias });
  const reset = await POST(request({ action: 'reset' }, verifiedCookie));
  expect(await reset.json()).toEqual({ verified: false, badge: null });
  const changed = await POST(request({ content: 'nuevo', thread_id: thread }, reset.headers.get('set-cookie')!.split(';')[0]));
  const after = (await changed.json()).entry;
  expect(after.verified).toBe(false);
  expect(after.alias).not.toBe(initial.alias);
});
