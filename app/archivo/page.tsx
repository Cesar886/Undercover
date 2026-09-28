'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, SmilePlus, ThumbsUp, TrendingUp } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { apiGet } from '@/lib/apiClient';
import { Post } from '@/types';
import { useFeedEvents } from '@/components/FeedStreamProvider';

type TopPost = Post & {
  top_score?: number;
  reaction_count?: number;
  net_votes?: number;
};

interface TopWeekResponse {
  posts: TopPost[];
  page: number;
  limit: number;
  hasMore: boolean;
}

const LIVE_EVENTS = new Set([
  'post:new',
  'post:vote',
  'post:reaction',
  'post:hidden',
  'post:visibility',
  'comment:new',
  'comment:deleted',
  'comment:reaction',
  'quema:total',
]);

function rankMovement(previous: Map<string, number>, postId: string, nextIndex: number): 'up' | 'down' | 'new' | null {
  const oldIndex = previous.get(postId);
  if (oldIndex === undefined) return 'new';
  if (oldIndex > nextIndex) return 'up';
  if (oldIndex < nextIndex) return 'down';
  return null;
}

export default function ArchivoPage() {
  const [posts, setPosts] = useState<TopPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<Record<string, 'up' | 'down' | 'new'>>({});
  const { message, showToast } = useToast();
  const rankRef = useRef<Map<string, number>>(new Map());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTop = useCallback(async (pg: number, replace: boolean, animate = false) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pg), limit: '10' });
    const result = await apiGet<TopWeekResponse>(`/api/posts/top-week?${params}`);
    if (result.ok) {
      const fetched = result.data.posts ?? [];
      setPosts((current) => {
        const next = replace ? fetched : [...current, ...fetched.filter((post) => !current.some((item) => item.id === post.id))];
        if (animate) {
          const movement: Record<string, 'up' | 'down' | 'new'> = {};
          next.forEach((post, index) => {
            const state = rankMovement(rankRef.current, post.id, index);
            if (state) movement[post.id] = state;
          });
          if (Object.keys(movement).length > 0) {
            setMoving(movement);
            window.setTimeout(() => setMoving({}), 900);
          }
        }
        rankRef.current = new Map(next.map((post, index) => [post.id, index]));
        return next;
      });
      setPage(result.data.page);
      setHasMore(result.data.hasMore);
    } else {
      showToast(result.error);
      if (replace) setPosts([]);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchTop(1, true);
  }, [fetchTop]);

  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  useFeedEvents(useCallback((event) => {
    if (!LIVE_EVENTS.has(event.type)) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchTop(1, true, true);
    }, 450);
  }, [fetchTop]));

  function loadMore() {
    fetchTop(page + 1, false);
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
          <TrendingUp size={16} className="text-violet-500" strokeWidth={1.7} />
          <h1 className="font-bold text-base text-gray-900 dark:text-[#e9e5ff]">Top semanal</h1>
          <span className="text-xs text-gray-400 dark:text-[#4a4870]">en vivo</span>
        </div>
      </div>

      <section className="rounded-2xl border border-black/[0.04] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-violet-500/10 dark:bg-[#0d0b1a] dark:shadow-none">
        <p className="text-sm font-semibold text-stone-800 dark:text-[#e9e5ff]">Lo más prendido de los últimos 7 días</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-400 dark:text-[#4a4870]">
          Ranking por comentarios, likes, reacciones y actividad reciente. Se actualiza solo cuando el hilo se mueve.
        </p>
      </section>

      <div className="space-y-3">
        {loading && posts.length === 0 ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length > 0 ? (
          posts.map((post, index) => {
            const motion = moving[post.id];
            return (
              <section
                key={post.id}
                className={`rounded-2xl transition-all duration-500 ${
                  motion === 'up'
                    ? 'translate-y-[-2px] ring-2 ring-emerald-300/60 shadow-[0_12px_30px_rgba(16,185,129,0.14)]'
                    : motion === 'down'
                      ? 'translate-y-[2px] ring-2 ring-amber-300/50 shadow-[0_10px_26px_rgba(245,158,11,0.10)]'
                      : motion === 'new'
                        ? 'ring-2 ring-violet-300/60 shadow-[0_12px_30px_rgba(139,92,246,0.14)]'
                        : ''
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] text-stone-400 dark:text-[#4a4870]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-600 px-2 text-[11px] font-bold text-white shadow-sm">
                      #{index + 1}
                    </span>
                    {motion === 'up' && <span className="font-semibold text-emerald-500">subiendo</span>}
                    {motion === 'down' && <span className="font-semibold text-amber-500">bajando</span>}
                    {motion === 'new' && <span className="font-semibold text-violet-500">nuevo</span>}
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="inline-flex items-center gap-1"><MessageCircle size={12} />{post.comment_count ?? 0}</span>
                    <span className="inline-flex items-center gap-1"><ThumbsUp size={12} />{post.net_votes ?? Math.max((post.upvotes ?? 0) - (post.downvotes ?? 0), 0)}</span>
                    <span className="inline-flex items-center gap-1"><SmilePlus size={12} />{post.reaction_count ?? 0}</span>
                  </div>
                </div>
                <PostCard
                  post={post}
                  currentUsername=""
                  onVoted={() => showToast('Voto guardado')}
                  onVoteError={(msg) => showToast(msg)}
                  onActionError={(msg) => showToast(msg)}
                  onReported={() => showToast('Reporte registrado.')}
                />
              </section>
            );
          })
        ) : (
          <div className="bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/10 rounded-2xl py-14 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
            <TrendingUp size={28} strokeWidth={1.5} className="mx-auto text-gray-200 dark:text-violet-900/60 mb-3" />
            <p className="text-gray-500 dark:text-[#6b6a8f] text-sm font-medium">Aún no hay top semanal</p>
            <p className="text-gray-400 dark:text-[#4a4870] text-xs mt-1">Cuando haya comentarios, votos o emojis aparecerán aquí.</p>
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
