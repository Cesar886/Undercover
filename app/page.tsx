'use client';
import { useState, useCallback, useEffect } from 'react';
import { PostForm } from '@/components/PostForm';
import { PostCard } from '@/components/PostCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Post, PostCategory } from '@/types';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState<PostCategory | 'all'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const { message, showToast } = useToast();

  const fetchPosts = useCallback(
    async (cat: PostCategory | 'all', pg: number, replace: boolean) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(pg) });
        if (cat !== 'all') qs.set('category', cat);
        const res = await fetch(`/api/posts?${qs}`);
        const data = await res.json();
        setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]));
        setHasMore(data.posts.length === 10);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(category, 1, true);
  }, [category, fetchPosts]);

  function handleCategoryChange(val: PostCategory | 'all') {
    setCategory(val);
  }

  function handlePostCreated() {
    setPage(1);
    fetchPosts(category, 1, true);
    showToast('Post publicado');
  }

  async function handleReport(postId: string) {
    await fetch(`/api/posts/${postId}/report`, { method: 'POST' });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post reportado');
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPosts(category, next, false);
  }

  const isInitialLoad = loading && posts.length === 0;

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <PostForm onPostCreated={handlePostCreated} />
      <CategoryFilter active={category} onChange={handleCategoryChange} />

      <div className="space-y-3">
        {isInitialLoad ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : (
          posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              onReport={handleReport}
              onVoted={() => showToast('Voto guardado')}
              style={{
                animationDelay: `${index * 60}ms`,
                animationFillMode: 'forwards',
              }}
              className="opacity-0 animate-fade-slide-in"
            />
          ))
        )}
        {!loading && posts.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">
            No hay posts todavía. ¡Sé el primero en quemar!
          </p>
        )}
      </div>

      {hasMore && !loading && posts.length > 0 && (
        <button
          onClick={loadMore}
          className="w-full py-3 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          Cargar más...
        </button>
      )}
      {loading && posts.length > 0 && (
        <p className="text-center text-zinc-600 text-sm py-4">Cargando...</p>
      )}

      <Toast message={message} />
    </main>
  );
}
