import { query } from './db';

export async function runQuema(): Promise<{ cleared: number }> {
  const res = await query(
    `UPDATE posts
     SET content = '', image_webp = NULL, archived = TRUE
     WHERE archived = FALSE AND is_hidden = FALSE
     RETURNING id`
  );

  const ids = res.rows.map((r) => r.id);
  if (ids.length === 0) return { cleared: 0 };

  await query(
    `DELETE FROM comment_votes
     WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ANY($1))`,
    [ids]
  );
  await query(`DELETE FROM votes         WHERE post_id = ANY($1)`, [ids]);
  await query(`DELETE FROM comments      WHERE post_id = ANY($1)`, [ids]);
  await query(`DELETE FROM notifications WHERE post_id = ANY($1)`, [ids]);

  return { cleared: ids.length };
}

export function isQuemaTime(): boolean {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Monterrey',
    weekday: 'short',
  }).format(now);
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Monterrey',
      hour: 'numeric',
      hour12: false,
    }).format(now),
    10
  );
  return weekday === 'Mon' && hour === 5;
}
