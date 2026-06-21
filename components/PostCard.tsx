'use client';
import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function timeAgoCompact(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)   return 'ahora';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d`;
  if (secs < 2592000) return `${Math.floor(secs / 604800)}sem`;
  if (secs < 31536000) return `${Math.floor(secs / 2592000)}mes`;
  return `${Math.floor(secs / 31536000)}a`;
}
import { Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory, ReportReason } from '@/types';
import { CategoryPill } from './CategoryPill';
import { ReactionsPanel } from './ReactionsPanel';
import { PostImage } from './PostImage';
import { AuthorMenu } from './AuthorMenu';
import { InlineEditor } from './InlineEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { ReportDialog } from './ReportDialog';
import { Tooltip } from '@mantine/core';
import { AnonAvatar } from './AnonAvatar';
import { anonDisplayName } from '@/lib/anonDisplay';
import { useFeedEvents } from './FeedStreamProvider';
import { apiDelete, apiPatch, apiPost } from '@/lib/apiClient';
import { ShareImageButton } from './ShareImageButton';

const accentBar: Record<PostCategory, string> = {
  general:     'bg-zinc-400 dark:bg-violet-900',
  quemones:    'bg-mauve-600 dark:bg-violet-600',
  infieles:    'bg-pink-500 dark:bg-violet-500',
  confesiones: 'bg-purple-600 dark:bg-violet-700',
};

interface PostCardProps {
  post: Post;
  currentUsername?: string;
  onVoted?: () => void;
  onVoteError?: (msg: string) => void;
  onDeleted?: (id: string) => void;
  onActionError?: (msg: string) => void;
  onReported?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function PostCard({
  post: initialPost,
  currentUsername,
  onVoted,
  onVoteError,
  onDeleted,
  onActionError,
  onReported,
  style,
  className,
}: PostCardProps) {
  const [post, setPost] = useState<Post>(initialPost);
  const [commentCount, setCommentCount] = useState(initialPost.comment_count ?? 0);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);

  const isAuthor = !!currentUsername && currentUsername === post.anon_id;

  const created = new Date(post.created_at);
  const timeAgo = timeAgoCompact(created);
  const editedTitle = post.updated_at
    ? `Editado el ${format(new Date(post.updated_at), "d 'de' MMMM, HH:mm", { locale: es })}`
    : undefined;

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'comment:new' && ev.postId === post.id) {
          setCommentCount((c) => c + 1);
          return;
        }
        if (ev.type === 'comment:deleted' && ev.postId === post.id && !ev.soft) {
          setCommentCount((c) => Math.max(0, c - 1));
          return;
        }
        if (ev.type === 'post:edited' && ev.post.id === post.id) {
          setPost((p) => ({ ...p, content: ev.post.content, updated_at: ev.post.updated_at }));
        }
      },
      [post.id]
    )
  );

  async function handleSaveEdit(content: string) {
    setSavingEdit(true);
    const r = await apiPatch<{ post: Post }>(`/api/posts/${post.id}`, { content });
    setSavingEdit(false);
    if (r.ok) {
      setPost(r.data.post);
      setEditing(false);
    } else {
      onActionError?.(r.error);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const r = await apiDelete<{ success: boolean }>(`/api/posts/${post.id}`);
    setDeleting(false);
    if (r.ok) {
      setConfirmDelete(false);
      onDeleted?.(post.id);
    } else {
      onActionError?.(r.error);
    }
  }

  async function handleReport(reason: ReportReason, detail?: string) {
    setSendingReport(true);
    const r = await apiPost(`/api/posts/${post.id}/report`, { reason, detail });
    setSendingReport(false);
    if (r.ok) {
      setReportOpen(false);
      onReported?.();
    } else {
      onActionError?.(r.error);
    }
  }

  return (
    <article
      ref={articleRef}
      style={style}
      className={`group relative bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/10 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_32px_rgba(124,58,237,0.12)] hover:border-black/[0.08] dark:hover:border-violet-500/25 dark:hover:bg-[#130f23] transition-all duration-300 cursor-pointer ${className ?? ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentBar[post.category]}`} />

      {/* stretched link — cubre toda la card; los elementos interactivos quedan encima con z-[2] */}
      {!editing && (
        <Link href={`/posts/${post.id}`} className="absolute inset-0 z-[1]" aria-label="Ver post completo" />
      )}

      <div className="pl-5 pr-4 pt-4 pb-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <AnonAvatar name={post.anon_id} size={28} className="ring-2 ring-white shadow-sm flex-shrink-0" />
            <span className="text-stone-500 dark:text-[#6b6a8f] text-xs font-mono">{anonDisplayName(post.anon_id)}</span>
            <CategoryPill category={post.category} />
          </div>
          <div className="relative z-[2] flex items-center gap-1.5">
            <span className="text-stone-400 dark:text-[#4a4870] text-[11px]">
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
              {' '}· {timeAgo}
              {post.updated_at && (
                <span title={editedTitle} className="text-stone-300 dark:text-[#2e2b4a]"> · editado</span>
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
          <div className="mb-3 relative z-[2]">
            <InlineEditor
              initial={post.content}
              maxChars={500}
              saving={savingEdit}
              onCancel={() => setEditing(false)}
              onSave={handleSaveEdit}
            />
          </div>
        ) : (
          <p className="text-stone-800 dark:text-[#e9e5ff] text-[15px] leading-relaxed break-words mb-3">
            {post.content}
          </p>
        )}

        {post.image_webp && !editing && (
          <div className="mb-3 relative z-[2]">
            <PostImage src={post.image_webp} className="max-h-72 w-auto rounded-lg" />
          </div>
        )}

        <div className="relative z-[2] flex items-center justify-between">
          <ReactionsPanel
            postId={post.id}
            upvotes={post.upvotes}
            downvotes={post.downvotes}
            onVoted={onVoted}
            onVoteError={onVoteError}
          />
          <div className="flex items-center gap-3">
            <Link
              href={`/posts/${post.id}`}
              className="flex items-center gap-1.5 text-stone-400 dark:text-[#4a4870] hover:text-stone-600 dark:hover:text-violet-400 text-xs transition-colors"
            >
              <MessageCircle size={13} strokeWidth={1.5} />
              <span>{commentCount}</span>
            </Link>
            {/* <ShareImageButton
              targetRef={articleRef}
              postId={post.id}
              onError={onActionError}
            /> */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`¡Mira esto en la UM! 🔥 ${process.env.NEXT_PUBLIC_BASE_URL}/posts/${post.id}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en WhatsApp"
              aria-label="Compartir en WhatsApp"
              className="text-stone-300 dark:text-[#2e2b4a] hover:text-[#25D366] dark:hover:text-[#25D366] transition-colors"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>
            {!isAuthor && (
              <button
                onClick={() => setReportOpen(true)}
                className="text-stone-300 dark:text-[#2e2b4a] hover:text-red-400 dark:hover:text-red-500 transition-colors"
                title="Reportar"
                aria-label="Reportar post"
              >
                <Flag size={13} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>

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
    </article>
  );
}
