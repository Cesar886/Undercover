'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory } from '@/types';
import { CategoryPill } from '@/components/CategoryPill';
import { VoteButtons } from '@/components/VoteButtons';
import { LocalComments } from '@/components/LocalComments';
import { PostSkeleton } from '@/components/PostSkeleton';
import { PostImage } from '@/components/PostImage';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { apiGet, apiPost } from '@/lib/apiClient';

const accent: Record<PostCategory, { bar: string; ring: string }> = {
  quemones:    { bar: 'bg-orange-500', ring: 'ring-orange-300/40' },
  infieles:    { bar: 'bg-pink-500',   ring: 'ring-pink-300/40' },
  confesiones: { bar: 'bg-purple-600', ring: 'ring-purple-300/40' },
};

type LoadState = { kind: 'loading' } | { kind: 'ok'; post: Post } | { kind: 'notfound' } | { kind: 'error'; msg: string };

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [commentCount, setCommentCount] = useState(0);
  const { message, showToast } = useToast();

  const loadPost = useCallback(async () => {
    setState({ kind: 'loading' });
    const r = await apiGet<{ post: Post | null }>(`/api/posts/${id}`);
    if (r.ok) {
      if (!r.data.post) setState({ kind: 'notfound' });
      else {
        setState({ kind: 'ok', post: r.data.post });
        setCommentCount(r.data.post.comment_count ?? 0);
      }
    } else if (r.status === 404) {
      setState({ kind: 'notfound' });
    } else {
      setState({ kind: 'error', msg: r.error });
    }
  }, [id]);

  useEffect(() => { loadPost(); }, [loadPost]);

  const handleCommentCount = useCallback((n: number) => setCommentCount(n), []);

  async function handleReport(postId: string) {
    const r = await apiPost(`/api/posts/${postId}/report`, {});
    if (r.ok) showToast('Reporte enviado');
    else showToast(r.error);
  }

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'post:vote' && ev.postId === id) {
          setState((s) => s.kind === 'ok' ? { kind: 'ok', post: { ...s.post, upvotes: ev.upvotes, downvotes: ev.downvotes } } : s);
          return;
        }
        if (ev.type === 'post:hidden' && ev.postId === id) setState({ kind: 'notfound' });
      },
      [id]
    )
  );

  if (state.kind === 'loading') {
    return (
      <main className="max-w-[600px] mx-auto px-4 pt-6 pb-16 space-y-5">
        <div className="h-4 w-20 rounded-full bg-gray-200 animate-pulse" />
        <PostSkeleton />
      </main>
    );
  }

  if (state.kind === 'notfound') {
    return (
      <main className="max-w-[600px] mx-auto px-6 pt-32 text-center space-y-4 animate-fade-in">
        <p className="text-2xl mb-2">🔥</p>
        <p className="text-xl font-semibold text-gray-700">Este quemón ya no existe.</p>
        <p className="text-sm text-gray-400">Quizá fue reportado, quizá nunca estuvo aquí.</p>
        <Link href="/" className="inline-block mt-4 text-sm text-orange-600 hover:text-orange-700 underline underline-offset-4">
          Volver al feed
        </Link>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className="max-w-[600px] mx-auto px-6 pt-32 text-center space-y-4 animate-fade-in">
        <p className="text-xl font-semibold text-gray-700">Algo se atoró cargando este quemón.</p>
        <p className="text-sm text-gray-500">{state.msg}</p>
        <button
          onClick={loadPost}
          className="mt-2 px-4 py-1.5 text-sm bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          Reintentar
        </button>
      </main>
    );
  }

  const post = state.post;
  const cat = accent[post.category];
  const created = new Date(post.created_at);
  const timeAgo = formatDistanceToNow(created, { addSuffix: true, locale: es });
  const fullDate = format(created, "d 'de' MMMM, HH:mm", { locale: es });
  const initials = post.anon_id.slice(0, 2).toUpperCase();

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 animate-fade-in">
      <Link
        href="/"
        className="group inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-6"
      >
        <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
        Volver al feed
      </Link>

      <article className={`relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm`}>
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cat.bar}`} />

        <div className="pl-5 pr-4 pt-4 pb-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${avatarColor(post.anon_id)}`}>
                <span className="text-[10px] font-bold">{initials}</span>
              </div>
              <span className="text-gray-500 text-xs">{post.anon_id}</span>
              <CategoryPill category={post.category} />
            </div>
            <span className="text-gray-400 text-[11px]" title={fullDate}>{timeAgo}</span>
          </div>

          {/* Content */}
          <p className="text-gray-800 text-[15px] leading-relaxed break-words mb-4">
            {post.content}
          </p>

          {post.image_webp && (
            <div className="mb-4">
              <PostImage src={post.image_webp} className="max-h-[520px] w-full object-cover rounded-xl" />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <VoteButtons
              postId={post.id}
              upvotes={post.upvotes}
              downvotes={post.downvotes}
              onVoted={() => showToast('Voto guardado')}
              onError={(msg) => showToast(msg)}
            />
            <div className="flex items-center gap-4 text-gray-400">
              <span className="flex items-center gap-1 text-xs">
                <MessageCircle size={13} />
                <span>{commentCount}</span>
              </span>
              <button
                onClick={() => handleReport(post.id)}
                className="flex items-center gap-1 text-xs hover:text-red-400 transition-colors"
                aria-label="Reportar"
              >
                <Flag size={13} />
                Reportar
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Comments */}
      <section className="mt-6">
        <LocalComments postId={post.id} onCountChange={handleCommentCount} />
      </section>

      <Toast message={message} />
    </main>
  );
}

function avatarColor(seed: string): string {
  const palette = [
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
    'bg-violet-100 text-violet-800',
    'bg-sky-100 text-sky-800',
    'bg-emerald-100 text-emerald-800',
    'bg-stone-200 text-stone-700',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
