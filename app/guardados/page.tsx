'use client';
import { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Post } from '@/types';

const KEY = 'bookmarked_posts';

export default function GuardadosPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { message, showToast } = useToast();

  useEffect(() => {
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {}

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    fetch(`/api/posts/batch?ids=${ids.join(',')}`)
      .then((r) => r.json())
      .then((data) => setPosts(data.posts ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleReport(postId: string) {
    await fetch(`/api/posts/${postId}/report`, { method: 'POST' });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post reportado');
  }

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bookmark size={16} className="text-orange-500" fill="currentColor" />
        <h1 className="text-gray-900 font-semibold text-sm">Guardados</h1>
      </div>

      {loading && (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">
          No tienes posts guardados todavía.
          <br />
          <span className="text-gray-300 text-xs">
            Usa el ícono <Bookmark size={11} className="inline" /> en cada post para guardarlos aquí.
          </span>
        </p>
      )}

      {!loading && posts.length > 0 && (
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
