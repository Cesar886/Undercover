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

  return NextResponse.json({ notifications, unread_count });
}

export async function PATCH() {
  const username = await getSessionUsername();
  if (!username) return unauthorized();

  await markAllNotificationsRead(username);
  return NextResponse.json({ ok: true });
}
