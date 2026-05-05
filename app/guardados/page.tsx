'use client';
import { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Post } from '@/types';
import { getAllPosts, hidePost } from '@/lib/localStore';

const BOOKMARKS_KEY = 'bookmarked_posts';

export default function GuardadosPage() {
  const [posts, setPosts]      = useState<Post[]>([]);
  const { message, showToast } = useToast();

  useEffect(() => {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? '[]');
      const all = getAllPosts();
      setPosts(all.filter((p) => ids.includes(p.id) && !p.is_hidden));
    } catch {}
  }, []);

  function handleReport(postId: string) {
    hidePost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post reportado');
  }

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bookmark size={16} className="text-orange-500" fill="currentColor" />
        <h1 className="text-gray-900 font-semibold text-sm">Guardados</h1>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-10">
          No tienes posts guardados todavía.
          <br />
          <span className="text-gray-300 text-xs">
            Usa el ícono <Bookmark size={11} className="inline" /> en cada post para guardarlos aquí.
          </span>
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              onReport={handleReport}
              onVoted={() => showToast('Voto guardado')}
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
              className="opacity-0 animate-fade-slide-in"
            />
          ))}
        </div>
      )}

      <Toast message={message} />
    </main>
  );
}
