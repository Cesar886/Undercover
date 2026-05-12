'use client';
import { useState, useCallback, useEffect } from 'react';
import { PostForm } from '@/components/PostForm';
import { PostCard } from '@/components/PostCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import { SortFilter, SortOption } from '@/components/SortFilter';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { apiGet } from '@/lib/apiClient';
import { Post, PostCategory } from '@/types';

export default function Home() {
  const [posts, setPosts]       = useState<Post[]>([]);
  const [category, setCategory] = useState<PostCategory | 'all'>('all');
  const [sort, setSort]         = useState<SortOption>('recent');
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [loading, setLoading]   = useState(true);
  const [username, setUsername] = useState('');
  const { message, showToast }  = useToast();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setUsername(data.user?.username ?? ''))
      .catch(() => {});
  }, []);

  const fetchPosts = useCallback(
    async (cat: PostCategory | 'all', s: SortOption, pg: number, replace: boolean) => {
      setLoading(true);
      const params = new URLSearchParams({ sort: s, page: String(pg) });
      if (cat !== 'all') params.set('category', cat);
      const result = await apiGet<{ posts: Post[] }>(`/api/posts?${params}`);
      if (result.ok) {
        const fetched = result.data.posts ?? [];
        setPosts((prev) => (replace ? fetched : [...prev, ...fetched]));
        setHasMore(fetched.length === 10);
      } else {
        showToast(result.error);
        if (replace) setPosts([]);
      }
      setLoading(false);
    },
    [showToast]
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(category, sort, 1, true);
  }, [category, sort, fetchPosts]);

  function handlePostCreated() {
    setPage(1);
    fetchPosts(category, sort, 1, true);
    showToast('Post publicado');
  }

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post eliminado');
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPosts(category, sort, next, false);
  }

  // Reactividad en vivo vía SSE.
  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'post:new') {
          // Solo insertar si encaja en el filtro y solo en orden "recent".
          if (sort !== 'recent') return;
          if (category !== 'all' && ev.post.category !== category) return;
          setPosts((prev) => (prev.some((p) => p.id === ev.post.id) ? prev : [ev.post, ...prev]));
          return;
        }
        if (ev.type === 'post:vote') {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === ev.postId ? { ...p, upvotes: ev.upvotes, downvotes: ev.downvotes } : p
            )
          );
          return;
        }
        if (ev.type === 'post:hidden') {
          setPosts((prev) => prev.filter((p) => p.id !== ev.postId));
          return;
        }
        if (ev.type === 'comment:new') {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === ev.postId
                ? { ...p, comment_count: (p.comment_count ?? 0) + 1 }
                : p
            )
          );
        }
      },
      [category, sort]
    )
  );

  const isInitialLoad = loading && posts.length === 0;

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
      <PostForm onPostCreated={handlePostCreated} />

      <div className="sticky top-12 z-40 -mx-4 px-4 py-2 bg-[#F9F9F9]/80 dark:bg-[#030303]/80 backdrop-blur-md border-b border-black/[0.04] dark:border-white/5">
        <div className="flex items-center gap-3 max-w-[600px] mx-auto">
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            <CategoryFilter active={category} onChange={setCategory} />
          </div>
          <div className="flex-shrink-0 pl-3 border-l border-gray-200/70">
            <SortFilter active={sort} onChange={setSort} compact />
          </div>
        </div>
      </div>

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
              currentUsername={username}
              onVoted={() => showToast('Voto guardado')}
              onVoteError={(msg) => showToast(msg)}
              onDeleted={handleDeleted}
              onActionError={(msg) => showToast(msg)}
              onReported={() => showToast('Gracias, lo revisaremos.')}
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
              className="opacity-0 animate-fade-slide-in"
            />
          ))
        )}

        {!loading && posts.length === 0 && (
          <div className="bg-white dark:bg-[#0c0c0c] border border-black/[0.04] dark:border-white/5 rounded-2xl py-14 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
            <p className="text-2xl mb-2">🔥</p>
            <p className="text-gray-500 dark:text-zinc-400 text-sm font-medium">Nada por aquí todavía</p>
            <p className="text-gray-400 dark:text-zinc-500 text-xs mt-1">Sé el primero en quemar algo</p>
          </div>
        )}
      </div>

      {hasMore && !loading && posts.length > 0 && (
        <button
          onClick={loadMore}
          className="w-full py-3 text-gray-400 hover:text-gray-600 text-sm transition-colors"
        >
          Cargar más
        </button>
      )}

      <Toast message={message} />
    </main>
  );
}
