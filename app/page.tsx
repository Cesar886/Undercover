'use client';
import { useState, useCallback, useEffect } from 'react';
import { PostForm } from '@/components/PostForm';
import { PostCard } from '@/components/PostCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import { SortFilter, SortOption } from '@/components/SortFilter';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Post, PostCategory } from '@/types';
import { queryPosts, hidePost } from '@/lib/localStore';

export default function Home() {
  const [posts, setPosts]       = useState<Post[]>([]);
  const [category, setCategory] = useState<PostCategory | 'all'>('all');
  const [sort, setSort]         = useState<SortOption>('recent');
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [loading, setLoading]   = useState(true);
  const { message, showToast }  = useToast();

  const fetchPosts = useCallback(
    (cat: PostCategory | 'all', s: SortOption, pg: number, replace: boolean) => {
      setLoading(true);
      const { posts: fetched, hasMore: more } = queryPosts({ category: cat, sort: s, page: pg });
      setPosts((prev) => (replace ? fetched : [...prev, ...fetched]));
      setHasMore(more);
      setLoading(false);
    },
    []
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

  function handleReport(postId: string) {
    hidePost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post reportado');
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPosts(category, sort, next, false);
  }

  const isInitialLoad = loading && posts.length === 0;

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
      <PostForm onPostCreated={handlePostCreated} />

      {/* Filter card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-2 overflow-x-auto scrollbar-hide">
          <CategoryFilter active={category} onChange={setCategory} />
        </div>
        <div className="px-4 border-t border-gray-100">
          <SortFilter active={sort} onChange={setSort} />
        </div>
      </div>

      {/* Feed */}
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
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
              className="opacity-0 animate-fade-slide-in"
            />
          ))
        )}

        {!loading && posts.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center shadow-sm">
            <p className="text-2xl mb-2">🔥</p>
            <p className="text-gray-500 text-sm font-medium">Nada por aquí todavía</p>
            <p className="text-gray-400 text-xs mt-1">Sé el primero en quemar algo</p>
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
