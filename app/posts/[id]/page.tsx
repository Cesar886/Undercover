'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory, ReportReason } from '@/types';
import { CategoryPill } from '@/components/CategoryPill';
import { LocalComments } from '@/components/LocalComments';
import { PostSkeleton } from '@/components/PostSkeleton';
import { PostImage } from '@/components/PostImage';
import { Toast } from '@/components/Toast';
import { AuthorMenu } from '@/components/AuthorMenu';
import { InlineEditor } from '@/components/InlineEditor';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ReportDialog } from '@/components/ReportDialog';
import { useToast } from '@/hooks/useToast';
import { ShareImageButton } from '@/components/ShareImageButton';
import { ReactionsPanel } from '@/components/ReactionsPanel';
import { PollView } from '@/components/PollView';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { Tooltip } from '@mantine/core';
import { AnonAvatar } from '@/components/AnonAvatar';
import { anonDisplayName } from '@/lib/anonDisplay';
import { useAnonId } from '@/hooks/useAnonId';

function timeAgoCompact(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)    return 'ahora';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d`;
  if (secs < 2592000) return `${Math.floor(secs / 604800)}sem`;
  if (secs < 31536000) return `${Math.floor(secs / 2592000)}mes`;
  return `${Math.floor(secs / 31536000)}a`;
}

const accent: Record<PostCategory, { bar: string; ring: string }> = {
  general:     { bar: 'bg-zinc-400 dark:bg-violet-900',  ring: 'ring-zinc-300/40 dark:ring-violet-800/40' },
  quemones:    { bar: 'bg-mauve-600 dark:bg-violet-600', ring: 'ring-mauve-400/40 dark:ring-violet-500/40' },
  infieles:    { bar: 'bg-pink-500 dark:bg-violet-500',  ring: 'ring-pink-300/40 dark:ring-violet-400/40' },
  confesiones: { bar: 'bg-purple-600 dark:bg-violet-700', ring: 'ring-purple-300/40 dark:ring-violet-600/40' },
};

const BOARD_NAMES: Record<PostCategory, string> = {
  general:     'General',
  quemones:    'Quemones',
  infieles:    'Infieles',
  confesiones: 'Confesiones',
};

function BackLink({ category, className = '' }: { category?: PostCategory; className?: string }) {
  const href  = category ? `/${category}` : '/';
  const label = category ? `Volver a ${BOARD_NAMES[category]}` : 'Volver al inicio';
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm transition-colors hover:text-stone-900 dark:bg-[#0d0b1a]/85 dark:text-[#9d98c8] dark:hover:text-violet-100 ${className}`}
    >
      <ArrowLeft size={13} strokeWidth={1.8} className="transition-transform group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}

type LoadState = { kind: 'loading' } | { kind: 'ok'; post: Post } | { kind: 'notfound' } | { kind: 'error'; msg: string };

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [commentCount, setCommentCount] = useState(0);
  const { anonId: username } = useAnonId();
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const { message, showToast } = useToast();
  const articleRef = useRef<HTMLDivElement>(null);

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

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'post:vote' && ev.postId === id) {
          setState((s) => s.kind === 'ok' ? { kind: 'ok', post: { ...s.post, upvotes: ev.upvotes, downvotes: ev.downvotes } } : s);
          return;
        }
        if (ev.type === 'post:hidden' && ev.postId === id) setState({ kind: 'notfound' });
        if (ev.type === 'post:edited' && ev.post.id === id) {
          setState((s) => s.kind === 'ok' ? { kind: 'ok', post: { ...s.post, content: ev.post.content, updated_at: ev.post.updated_at } } : s);
        }
      },
      [id]
    )
  );

  if (state.kind === 'loading') {
    return (
      <main className="max-w-[600px] mx-auto px-4 pt-6 pb-16 space-y-5">
        <BackLink />
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
        <BackLink className="mt-4" />
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className="max-w-[600px] mx-auto px-6 pt-32 text-center space-y-4 animate-fade-in">
        <p className="text-xl font-semibold text-gray-700">Algo se atoró cargando este quemón.</p>
        <p className="text-sm text-gray-500">{state.msg}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <BackLink />
          <button
            onClick={loadPost}
            className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </main>
    );
  }

  const post = state.post;
  const cat = accent[post.category];
  const created = new Date(post.created_at);
  const timeAgo = timeAgoCompact(created);
  const fullDate = format(created, "d 'de' MMMM, HH:mm", { locale: es });
  const editedTitle = post.updated_at
    ? `Editado el ${format(new Date(post.updated_at), "d 'de' MMMM, HH:mm", { locale: es })}`
    : undefined;
  const isAuthor = !!username && username === post.anon_id;

  async function handleSaveEdit(content: string) {
    setSavingEdit(true);
    const r = await apiPatch<{ post: Post }>(`/api/posts/${post.id}`, { content });
    setSavingEdit(false);
    if (r.ok) {
      setState({ kind: 'ok', post: r.data.post });
      setEditing(false);
    } else {
      showToast(r.error);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const r = await apiDelete<{ success: boolean }>(`/api/posts/${post.id}`);
    setDeleting(false);
    if (r.ok) {
      setConfirmDelete(false);
      showToast('Post eliminado');
      router.push('/');
    } else {
      showToast(r.error);
    }
  }

  async function handleReport(reason: ReportReason, detail?: string) {
    setSendingReport(true);
    const r = await apiPost(`/api/posts/${post.id}/report`, { reason, detail });
    setSendingReport(false);
    if (r.ok) {
      setReportOpen(false);
      showToast('Gracias, lo revisaremos.');
    } else {
      showToast(r.error);
    }
  }

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 animate-fade-in">
      <BackLink category={post.category} className="mb-5" />

      <article ref={articleRef} className={`relative bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/12 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(124,58,237,0.1)]`}>
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cat.bar}`} />

        <div className="pl-5 pr-4 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AnonAvatar name={post.anon_id} size={28} className="flex-shrink-0" />
              <span className="text-gray-500 dark:text-[#6b6a8f] text-xs font-mono">{anonDisplayName(post.anon_id)}</span>
              <CategoryPill category={post.category} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-[11px]">
                <Tooltip
                  label="La confianza sube con votos positivos y baja con reportes o votos negativos."
                  withArrow
                  multiline
                  w={220}
                  events={{ hover: true, focus: true, touch: true }}
                  transitionProps={{ transition: 'fade', duration: 200 }}
                  classNames={{
                    tooltip: 'bg-white dark:bg-[#0d0b1a] text-stone-600 dark:text-violet-200 border border-black/10 dark:border-violet-500/20 shadow-xl text-xs rounded-xl px-3 py-2',
                    arrow: 'border-l border-t border-black/10 dark:border-violet-500/20'
                  }}
                >
                  <span className="font-mono cursor-help hover:text-stone-600 dark:hover:text-violet-400 transition-colors">
                    {post.trust_unlocked ? `[trust:${post.trust_score ?? 0}]` : '[trust:?]'}
                  </span>
                </Tooltip>
                {' '}· <span title={fullDate}>{timeAgo}</span>
                {post.updated_at && (
                  <span title={editedTitle} className="text-stone-300"> · editado</span>
                )}
              </span>
              {isAuthor && !editing && (
                <AuthorMenu
                  size="sm"
                  onEdit={() => setEditing(true)}
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </div>
          </div>

          {editing ? (
            <div className="mb-4">
              <InlineEditor
                initial={post.content}
                maxChars={500}
                saving={savingEdit}
                onCancel={() => setEditing(false)}
                onSave={handleSaveEdit}
              />
            </div>
          ) : (
            <p className="text-gray-800 dark:text-[#e9e5ff] text-[15px] leading-relaxed break-words mb-4">
              {post.content}
            </p>
          )}

          {post.image_webp && !editing && (
            <div className="mb-4">
              <PostImage src={post.image_webp} />
            </div>
          )}

          {post.poll && !editing && (
            <div className="mb-4">
              <PollView
                postId={post.id}
                poll={post.poll}
                disabled={post.archived}
                onChange={(poll) => setState((s) => s.kind === 'ok' ? { kind: 'ok', post: { ...s.post, poll } } : s)}
                onError={(msg) => showToast(msg)}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-violet-500/10">
            <ReactionsPanel
              postId={post.id}
              upvotes={post.upvotes}
              downvotes={post.downvotes}
              onVoted={() => showToast('Voto guardado')}
              onVoteError={(msg) => showToast(msg)}
            />
            <div className="flex items-center gap-4 text-gray-400 dark:text-[#4a4870]">
              <span className="flex items-center gap-1 text-xs">
                <MessageCircle size={13} />
                <span>{commentCount}</span>
              </span>
              {/* <ShareImageButton
                targetRef={articleRef}
                postId={post.id}
                onError={(msg) => showToast(msg)}
              /> */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`¡Mira esto en la UM! 🔥 ${process.env.NEXT_PUBLIC_BASE_URL}/posts/${post.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs hover:text-[#25D366] transition-colors"
                aria-label="Compartir en WhatsApp"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Compartir
              </a>
              {!isAuthor && (
                <button
                  onClick={() => setReportOpen(true)}
                  className="flex items-center gap-1 text-xs hover:text-red-400 transition-colors"
                  aria-label="Reportar"
                >
                  <Flag size={13} />
                  Reportar
                </button>
              )}
            </div>
          </div>
        </div>
      </article>

      <section className="mt-6">
        <LocalComments postId={post.id} archived={post.archived} onCountChange={handleCommentCount} />
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar post?"
        description="Esta acción no se puede deshacer. Se borrará el post junto con todos sus comentarios."
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />

      <ReportDialog
        open={reportOpen}
        busy={sendingReport}
        onCancel={() => setReportOpen(false)}
        onSubmit={handleReport}
      />

      <Toast message={message} />
    </main>
  );
}

