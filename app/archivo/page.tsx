'use client';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Archive, ArrowLeft } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { apiGet } from '@/lib/apiClient';
import { Post, PostCategory } from '@/types';

export default function ArchivoPage() {
  const [posts, setPosts]       = useState<Post[]>([]);
  const [category, setCategory] = useState<PostCategory | 'all'>('all');
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [loading, setLoading]   = useState(true);
  const { message, showToast }  = useToast();

  const fetchPosts = useCallback(
    async (cat: PostCategory | 'all', pg: number, replace: boolean) => {
      setLoading(true);
      const params = new URLSearchParams({ archived: 'true', page: String(pg) });
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
    fetchPosts(category, 1, true);
  }, [category, fetchPosts]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPosts(category, next, false);
  }

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm transition-colors hover:text-stone-900 dark:bg-[#0d0b1a]/85 dark:text-[#9d98c8] dark:hover:text-violet-100"
        >
          <ArrowLeft size={13} strokeWidth={1.8} className="transition-transform group-hover:-translate-x-0.5" />
          Inicio
        </Link>
        <div className="flex items-center gap-2">
          <Archive size={16} className="text-violet-500" strokeWidth={1.5} />
          <h1 className="font-bold text-base text-gray-900 dark:text-[#e9e5ff]">Archivo</h1>
          <span className="text-xs text-gray-400 dark:text-[#4a4870]">solo lectura</span>
        </div>
      </div>

      <div className="sticky top-12 z-40 -mx-4 px-4 py-2 bg-[#F9F9F9]/80 dark:bg-[#06050f]/90 backdrop-blur-md border-b border-black/[0.04] dark:border-violet-500/10">
        <div className="flex items-center gap-3 max-w-[600px] mx-auto">
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            <CategoryFilter active={category} onChange={setCategory} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading && posts.length === 0 ? (
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
              currentUsername=""
              onVoted={() => {}}
              onVoteError={(msg) => showToast(msg)}
              onReported={() => showToast('Gracias, lo revisaremos.')}
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
              className="opacity-0 animate-fade-slide-in"
            />
          ))
        )}

        {!loading && posts.length === 0 && (
          <div className="bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/10 rounded-2xl py-14 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
            <Archive size={28} strokeWidth={1.5} className="mx-auto text-gray-200 dark:text-violet-900/60 mb-3" />
            <p className="text-gray-500 dark:text-[#6b6a8f] text-sm font-medium">El archivo está vacío</p>
            <p className="text-gray-400 dark:text-[#4a4870] text-xs mt-1">Los hilos populares aparecerán aquí cuando expiren</p>
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

      <p className="text-center text-xs text-gray-300 dark:text-[#2e2b4a] pt-2">
        Los hilos archivados son de solo lectura.{' '}
        <Link href="/" className="underline hover:text-gray-500 transition-colors">
          Volver al tablón
        </Link>
      </p>

      <Toast message={message} />
    </main>
  );
}
