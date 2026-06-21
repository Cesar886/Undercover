'use client';
import { useState, useCallback, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { PostForm } from '@/components/PostForm';
import { PostCard } from '@/components/PostCard';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { apiGet } from '@/lib/apiClient';
import { useAnonId } from '@/hooks/useAnonId';
import { isValidBoard, getBoard } from '@/lib/boards';
import { Post, PostCategory } from '@/types';

export default function BoardPage({ params }: { params: { board: string } }) {
  const { board } = params;

  if (!isValidBoard(board)) notFound();

  const boardMeta = getBoard(board)!;

  const [posts, setPosts]           = useState<Post[]>([]);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(true);
  const { message, showToast }      = useToast();
  const { anonId: username }        = useAnonId();

  const fetchPosts = useCallback(
    async (pg: number, replace: boolean) => {
      setLoading(true);
      const p = new URLSearchParams({ sort: 'recent', page: String(pg), category: board });
      const result = await apiGet<{ posts: Post[] }>(`/api/posts?${p}`);
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
    [board, showToast]
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(1, true);
  }, [fetchPosts]);

  function handlePostCreated() {
    setPage(1);
    fetchPosts(1, true);
    showToast('Post publicado');
  }

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post eliminado');
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, false);
  }

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'post:new') {
          if (ev.post.category !== board) return;
          setPosts((prev) => {
            if (prev.some((p) => p.id === ev.post.id)) return prev;
            setNewPostIds((ids) => new Set([...ids, ev.post.id]));
            setTimeout(() => {
              setNewPostIds((ids) => { const n = new Set(ids); n.delete(ev.post.id); return n; });
            }, 600);
            return [ev.post, ...prev];
          });
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
              p.id === ev.postId ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p
            )
          );
        }
      },
      [board]
    )
  );

  const isInitialLoad = loading && posts.length === 0;

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
      <div className="flex items-baseline gap-2 mb-1">
        <h1
          className="font-bold text-xl"
          style={{ color: boardMeta.text }}
        >
          {boardMeta.name}
        </h1>
        <span className="text-sm text-gray-400 dark:text-[#4a4870]">
          {boardMeta.description}
        </span>
      </div>

      <PostForm
        onPostCreated={handlePostCreated}
        defaultCategory={board as PostCategory}
        lockedCategory
      />

      <div className="space-y-3">
        {isInitialLoad ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : (
          posts.map((post, index) => {
            const isNew = newPostIds.has(post.id);
            return (
              <PostCard
                key={post.id}
                post={post}
                currentUsername={username}
                onVoted={() => showToast('Voto guardado')}
                onVoteError={(msg) => showToast(msg)}
                onDeleted={handleDeleted}
                onActionError={(msg) => showToast(msg)}
                onReported={() => showToast('Gracias, lo revisaremos.')}
                style={isNew ? undefined : { animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
                className={isNew ? 'animate-new-post-slide' : 'opacity-0 animate-fade-slide-in'}
              />
            );
          })
        )}

        {!loading && posts.length === 0 && (
          <div className="bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/10 rounded-2xl py-14 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
            <p className="text-2xl mb-2">🔥</p>
            <p className="text-gray-500 dark:text-[#6b6a8f] text-sm font-medium">Nada por aquí todavía</p>
            <p className="text-gray-400 dark:text-[#4a4870] text-xs mt-1">Sé el primero en quemar algo</p>
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
