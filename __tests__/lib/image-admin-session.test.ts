jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/imageReviews', () => ({ ensureImageReviewSchema: jest.fn() }));
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { hasImageAdminSession, createImageAdminSession, deleteImageAdminSession, checkImageAdminCredentials } from '@/lib/imageAdmin';
const token = 'a'.repeat(64);
beforeEach(() => jest.clearAllMocks());

it('rejects absent and malformed cookies without database access', async () => {
  (cookies as jest.Mock).mockReturnValue({ get: () => undefined });
  expect(await hasImageAdminSession()).toBe(false);
  (cookies as jest.Mock).mockReturnValue({ get: () => ({ value: 'forged' }) });
  expect(await hasImageAdminSession()).toBe(false);
  expect(query).not.toHaveBeenCalled();
});
it('checks both the session hash and expiry in PostgreSQL', async () => {
  (cookies as jest.Mock).mockReturnValue({ get: () => ({ value: token }) });
  (query as jest.Mock).mockResolvedValue({ rows: [] });
  expect(await hasImageAdminSession()).toBe(false);
  (query as jest.Mock).mockResolvedValue({ rows: [{}] });
  expect(await hasImageAdminSession()).toBe(true);
  expect((query as jest.Mock).mock.calls[0][0]).toContain('expires_at > NOW()');
  expect((query as jest.Mock).mock.calls[0][1][0]).not.toBe(token);
});
it('persists only hashes of randomly generated session tokens', async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [] });
  const first = await createImageAdminSession();
  const second = await createImageAdminSession();
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(second).not.toBe(first);
  expect(JSON.stringify((query as jest.Mock).mock.calls)).not.toContain(first);
});
it('removes the stored session when logging out', async () => {
  (cookies as jest.Mock).mockReturnValue({ get: () => ({ value: token }) });
  await deleteImageAdminSession();
  expect((query as jest.Mock).mock.calls[0][0]).toContain('DELETE FROM image_admin_sessions');
});
it('rejects wrong usernames and passwords', async () => {
  expect(await checkImageAdminCredentials('other', 'incorrect')).toBe(false);
  expect(await checkImageAdminCredentials('admin', 'incorrect')).toBe(false);
  expect(await checkImageAdminCredentials('admin', null)).toBe(false);
});
