jest.mock('@/lib/auth', () => ({ getSessionUsername: async () => 'recipient' }));
jest.mock('@/lib/notifications', () => ({
  getNotifications: async () => [{ id: 'notification', post_id: 'thread', type: 'comment_reply',
    actor_username: 'private-actor', recipient_username: 'recipient', future_secret: 'secret' }],
  getUnreadCount: async () => 1,
}));
import { GET } from '@/app/api/notifications/route';
it('removes account identifiers and scopes the notification actor', async () => {
  process.env.ANON_SALT = 'notification-privacy-test';
  const res = await GET();
  const body = await res.json();
  expect(body.notifications[0].actor_username).toMatch(/^Anon#[A-F0-9]{8}$/);
  expect(JSON.stringify(body)).not.toMatch(/private-actor|recipient|future_secret/);
  expect(res.headers.get('cache-control')).toContain('no-store');
});
