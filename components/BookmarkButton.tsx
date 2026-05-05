'use client';
import { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';

const KEY = 'bookmarked_posts';

export function BookmarkButton({ postId }: { postId: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      setSaved(ids.includes(postId));
    } catch {}
  }, [postId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    setSaved((prev) => {
      try {
        const ids: string[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        const next = prev ? ids.filter((x) => x !== postId) : [...ids, postId];
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return !prev;
    });
  }

  return (
    <button
      onClick={toggle}
      className={`transition-colors ${saved ? 'text-orange-500' : 'text-gray-300 hover:text-gray-500'}`}
      title={saved ? 'Quitar de guardados' : 'Guardar'}
      aria-label="Guardar post"
    >
      <Bookmark size={13} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
