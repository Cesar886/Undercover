import { query } from './db';
import { PoolClient } from 'pg';
import type { Notification, NotificationType } from '@/types';

export async function createNotification(
  recipient: string,
  type: NotificationType,
  postId: string,
  commentId: string | null,
  actor: string | null,
  client?: PoolClient
): Promise<Notification | null> {
  if (actor === recipient) return null;
  const run = client
    ? (sql: string, params: unknown[]) => client.query(sql, params)
    : query;
  const res = await run(
    `INSERT INTO notifications (recipient_username, type, post_id, comment_id, actor_username)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [recipient, type, postId, commentId, actor]
  );
  return (res.rows[0] as Notification) ?? null;
}

export async function getNotifications(username: string): Promise<Notification[]> {
  const res = await query(
    `SELECT * FROM notifications
     WHERE recipient_username = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [username]
  );
  return res.rows as Notification[];
}

export async function getUnreadCount(username: string): Promise<number> {
  const res = await query(
    'SELECT COUNT(*) FROM notifications WHERE recipient_username = $1 AND is_read = false',
    [username]
  );
  return parseInt(res.rows[0].count, 10);
}

export async function markNotificationRead(id: string, username: string): Promise<void> {
  await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_username = $2',
    [id, username]
  );
}

export async function markAllNotificationsRead(username: string): Promise<void> {
  await query(
    'UPDATE notifications SET is_read = true WHERE recipient_username = $1',
    [username]
  );
}
