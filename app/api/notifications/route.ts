import { threadAlias } from '@/lib/publicIdentity';
import { anonDisplayName } from '@/lib/anonDisplay';
import { NextResponse } from 'next/server';
import { getSessionUsername, unauthorized } from '@/lib/auth';
import { getNotifications, getUnreadCount, markAllNotificationsRead } from '@/lib/notifications';

export async function GET() {
  const username = await getSessionUsername();
  if (!username) return unauthorized();

  const [notifications, unread_count] = await Promise.all([
    getNotifications(username),
    getUnreadCount(username),
  ]);

  const publicNotifications = notifications.map(n => ({
    id: n.id, type: n.type, post_id: n.post_id, comment_id: n.comment_id,
    is_read: n.is_read, created_at: n.created_at,
    actor_username: n.actor_username ? anonDisplayName(threadAlias(n.actor_username, n.post_id)) : null,
  }));
  return NextResponse.json({ notifications: publicNotifications, unread_count }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function PATCH() {
  const username = await getSessionUsername();
  if (!username) return unauthorized();

  await markAllNotificationsRead(username);
  return NextResponse.json({ ok: true });
}
