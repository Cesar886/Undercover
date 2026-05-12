# Notifications System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real-time per-user notification system that alerts users when someone likes or comments on their posts/comments.

**Architecture:** Persist notifications in a `notifications` table; extend the existing SSE event bus (`lib/events.ts`) with a `notification:new` event filtered per recipient in the stream route; surface notifications via a `NotificationBell` component in the Navbar with a live unread badge and dropdown panel.

**Tech Stack:** Next.js 14, PostgreSQL (pg), SSE (EventSource), Tailwind CSS, Lucide React, date-fns

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `sql/notifications.sql` | Create | DDL for notifications table |
| `types/index.ts` | Modify | Add `Notification` type and `NotificationType` |
| `lib/notifications.ts` | Create | CRUD helpers: createNotification, getNotifications, getUnreadCount, markAllRead |
| `lib/events.ts` | Modify | Add `notification:new` to FeedEvent union |
| `app/api/stream/route.ts` | Modify | Filter notification events by recipient username |
| `app/api/notifications/route.ts` | Create | GET list + PATCH mark-all-read |
| `app/api/notifications/[id]/read/route.ts` | Create | PATCH mark single read |
| `app/api/posts/[id]/vote/route.ts` | Modify | Trigger `post_like` notification |
| `app/api/posts/[id]/comments/route.ts` | Modify | Trigger `post_comment` + `comment_reply` notifications |
| `app/api/posts/[id]/comments/[commentId]/vote/route.ts` | Modify | Trigger `comment_like` notification |
| `components/NotificationBell.tsx` | Create | Bell icon + badge + dropdown panel |
| `components/Navbar.tsx` | Modify | Mount NotificationBell when logged in |
| `components/FeedStreamProvider.tsx` | Modify | Listen for `notification:new` SSE event type |

---

### Task 1: Create SQL table

**Files:**
- Create: `sql/notifications.sql`

- [ ] Write migration SQL

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_username TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('post_like','post_comment','comment_reply','comment_like')),
  post_id UUID NOT NULL,
  comment_id UUID,
  actor_username TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_username, created_at DESC);
```

- [ ] Run against the DB:

```bash
psql $DATABASE_URL -f sql/notifications.sql
```

- [ ] Commit

```bash
git add sql/notifications.sql
git commit -m "feat(db): add notifications table"
```

---

### Task 2: Add Notification type

**Files:**
- Modify: `types/index.ts`

- [ ] Add types at the bottom of the file

```typescript
export type NotificationType = 'post_like' | 'post_comment' | 'comment_reply' | 'comment_like';

export interface Notification {
  id: string;
  recipient_username: string;
  type: NotificationType;
  post_id: string;
  comment_id: string | null;
  actor_username: string | null;
  is_read: boolean;
  created_at: string;
}
```

---

### Task 3: Create lib/notifications.ts

**Files:**
- Create: `lib/notifications.ts`

- [ ] Write the file

```typescript
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
```

---

### Task 4: Extend FeedEvent union

**Files:**
- Modify: `lib/events.ts`

- [ ] Add import for Notification type and extend the FeedEvent union

```typescript
import { EventEmitter } from 'events';
import { Comment, Post, Notification } from '@/types';

export type FeedEvent =
  | { type: 'post:new'; post: Post }
  | { type: 'post:vote'; postId: string; upvotes: number; downvotes: number }
  | { type: 'post:hidden'; postId: string }
  | { type: 'post:edited'; post: Post }
  | { type: 'comment:new'; postId: string; comment: Comment }
  | { type: 'comment:edited'; postId: string; comment: Comment }
  | { type: 'comment:deleted'; postId: string; commentId: string; soft: boolean }
  | { type: 'notification:new'; recipient: string; notification: Notification };
```

---

### Task 5: Filter notification events in the SSE stream

**Files:**
- Modify: `app/api/stream/route.ts`

- [ ] Capture username and filter notification events

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { subscribeFeed, FeedEvent } from '@/lib/events';
import { getSessionUsername } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const currentUsername = await getSessionUsername();
  if (!currentUsername) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // controller ya cerrado
        }
      };

      const sendEvent = (ev: FeedEvent) => {
        if (ev.type === 'notification:new' && ev.recipient !== currentUsername) return;
        safeEnqueue(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      };

      safeEnqueue(`event: ready\ndata: {}\n\n`);

      const unsubscribe = subscribeFeed(sendEvent);

      const heartbeat = setInterval(() => safeEnqueue(`: ping\n\n`), 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

---

### Task 6: Create /api/notifications/route.ts

**Files:**
- Create: `app/api/notifications/route.ts`

- [ ] Write GET + PATCH handlers

```typescript
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
```

---

### Task 7: Create /api/notifications/[id]/read/route.ts

**Files:**
- Create: `app/api/notifications/[id]/read/route.ts`

- [ ] Write PATCH handler

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername, unauthorized } from '@/lib/auth';
import { markNotificationRead } from '@/lib/notifications';
import { isUuid } from '@/lib/validation';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const username = await getSessionUsername();
  if (!username) return unauthorized();

  await markNotificationRead(params.id, username);
  return NextResponse.json({ ok: true });
}
```

---

### Task 8: Trigger notifications in API routes

**Files:**
- Modify: `app/api/posts/[id]/vote/route.ts`
- Modify: `app/api/posts/[id]/comments/route.ts`
- Modify: `app/api/posts/[id]/comments/[commentId]/vote/route.ts`

#### 8a — post vote (post_like)

In `posts/[id]/vote/route.ts`, after the `withTransaction` call (where `postAuthor` is already available inside), extract it and emit after:

Add import: `import { createNotification } from '@/lib/notifications';`

Inside `withTransaction`, after the milestone check, store author and return it alongside votes:
- Read `postAuthor` which is already fetched
- Call `createNotification(postAuthor, 'post_like', postId, null, voterUsername, client)` inside the transaction only when `vote_type === 'up'`

After transaction call `emitFeed` for the notification.

#### 8b — comment create (post_comment + comment_reply)

In `posts/[id]/comments/route.ts`, after the comment is inserted:
- Add import: `import { createNotification } from '@/lib/notifications';`
- Fetch post author
- If reply, fetch parent comment author
- Emit notifications avoiding self-notify and duplicates

#### 8c — comment vote (comment_like)

In `posts/[id]/comments/[commentId]/vote/route.ts`:
- Add import: `import { createNotification } from '@/lib/notifications';`
- `commentAuthor` is already fetched from the UPDATE RETURNING
- Create comment_like notification inside transaction when `vote_type === 'up'`
- Emit after transaction

---

### Task 9: Create NotificationBell component

**Files:**
- Create: `components/NotificationBell.tsx`

- [ ] Write the component

```tsx
'use client';
import { Bell } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import type { Notification } from '@/types';

function notificationText(n: Notification): string {
  const actor = n.actor_username ? `@${n.actor_username}` : 'Alguien';
  switch (n.type) {
    case 'post_like':     return 'Tu publicación recibió un like';
    case 'post_comment':  return `${actor} comentó en tu publicación`;
    case 'comment_reply': return `${actor} respondió a tu comentario`;
    case 'comment_like':  return 'Tu comentario recibió un like';
  }
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnread(data.unread_count ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  useFeedEvents(
    useCallback((ev) => {
      if (ev.type === 'notification:new') {
        setNotifications((prev) => [ev.notification, ...prev.slice(0, 29)]);
        setUnread((c) => c + 1);
      }
    }, [])
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleToggle() {
    const opening = !open;
    setOpen(opening);
    if (opening && unread > 0) {
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await fetch('/api/notifications', { method: 'PATCH' });
    }
  }

  if (loading) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className="relative text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
        aria-label="Notificaciones"
      >
        <Bell size={18} strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-mauve-600 text-white text-[10px] font-bold leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg text-sm z-50">
          <div className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
            Notificaciones
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-gray-400 dark:text-zinc-500 text-xs">
              Sin notificaciones aún
            </p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                href={`/posts/${n.post_id}`}
                onClick={() => setOpen(false)}
                className={`flex flex-col gap-0.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors border-b border-gray-50 dark:border-zinc-800/50 last:border-0 ${
                  !n.is_read ? 'bg-mauve-50/60 dark:bg-mauve-900/10' : ''
                }`}
              >
                <span className={`text-gray-800 dark:text-zinc-200 leading-snug ${!n.is_read ? 'font-medium' : ''}`}>
                  {notificationText(n)}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-zinc-500">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

---

### Task 10: Add notification:new to FeedStreamProvider event list

**Files:**
- Modify: `components/FeedStreamProvider.tsx`

- [ ] Add `'notification:new'` to the `types` array

---

### Task 11: Add NotificationBell to Navbar

**Files:**
- Modify: `components/Navbar.tsx`

- [ ] Import `NotificationBell` and render it next to the avatar button when `username` is truthy

---

### Task 12: Commit everything

```bash
git add -A
git commit -m "feat(notifications): sistema completo de notificaciones en tiempo real"
```
