'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory } from '@/types';
import { colorFor } from '@/lib/avatar';
import { CategoryPill } from '@/components/CategoryPill';
import { VoteButtons } from '@/components/VoteButtons';
import { LocalComments } from '@/components/LocalComments';
import { PostSkeleton } from '@/components/PostSkeleton';
import { PostImage } from '@/components/PostImage';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { apiGet, apiPost } from '@/lib/apiClient';

const accentBar: Record<PostCategory, string> = {
  quemones:    'bg-orange-500',
  infieles:    'bg-pink-500',
  confesiones: 'bg-purple-600',
  rumores:     'bg-blue-500',
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
      if (!r.data.post) {
        setState({ kind: 'notfound' });
      } else {
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
        if (ev.type === 'post:hidden' && ev.postId === id) {
          setState({ kind: 'notfound' });
        }
      },
      [id]
    )
  );

  if (state.kind === 'loading') {
    return (
      <main className="max-w-[680px] mx-auto px-4 pt-6 pb-16 space-y-5">
        <div className="h-4 w-20 rounded-full bg-gray-100 animate-pulse" />
        <PostSkeleton />
      </main>
    );
  }

  if (state.kind === 'notfound') {
    return (
      <main className="max-w-[680px] mx-auto px-4 pt-20 text-center space-y-3">
        <p className="text-gray-400 text-sm">Este quemón ya no existe.</p>
        <Link href="/" className="text-orange-500 text-sm hover:underline">
          Volver al feed
        </Link>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className="max-w-[680px] mx-auto px-4 pt-20 text-center space-y-3">
        <p className="text-gray-500 text-sm">{state.msg}</p>
        <button
          onClick={loadPost}
          className="text-orange-500 text-sm hover:underline"
        >
          Reintentar
        </button>
      </main>
    );
  }

  const post = state.post;
  const timeAgo  = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es });
  const initials = post.anon_id.slice(0, 2).toUpperCase();

  return (
    <main className="max-w-[680px] mx-auto px-4 pt-6 pb-16 space-y-4">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        Volver al feed
      </Link>

      {/* Post card */}
      <article className="relative bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Category accent */}
        <div className={`absolute inset-y-0 left-0 w-1 ${accentBar[post.category]}`} />

        <div className="pl-6 pr-5 pt-5 pb-4 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${colorFor(post.anon_id)}`}>
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{post.anon_id}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CategoryPill category={post.category} />
                </div>
              </div>
            </div>
            <time className="text-xs text-gray-400 flex-shrink-0">{timeAgo}</time>
          </div>

          {/* Content */}
          <p className="text-gray-800 text-[17px] leading-relaxed break-words">
            {post.content}
          </p>

          {post.image_webp && (
            <PostImage src={post.image_webp} className="max-h-96 w-auto" />
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-50">
            <VoteButtons
              postId={post.id}
              upvotes={post.upvotes}
              downvotes={post.downvotes}
              onVoted={() => showToast('Voto guardado')}
              onError={(msg) => showToast(msg)}
            />
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <MessageCircle size={13} />
                {commentCount}
              </span>
              <button
                onClick={() => handleReport(post.id)}
                className="flex items-center gap-1.5 hover:text-red-400 transition-colors"
              >
                <Flag size={13} />
                Reportar
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Comments */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <LocalComments postId={post.id} onCountChange={handleCommentCount} />
      </section>

      <Toast message={message} />
    </main>
  );
}
