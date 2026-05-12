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
      .catch(() => {})
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
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {});
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
