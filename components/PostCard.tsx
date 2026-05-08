'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory, ReportReason } from '@/types';
import { CategoryPill } from './CategoryPill';
import { VoteButtons } from './VoteButtons';
import { PostImage } from './PostImage';
import { AuthorMenu } from './AuthorMenu';
import { InlineEditor } from './InlineEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { ReportDialog } from './ReportDialog';
import { colorFor } from '@/lib/avatar';
import { useFeedEvents } from './FeedStreamProvider';
import { apiDelete, apiPatch, apiPost } from '@/lib/apiClient';

const accentBar: Record<PostCategory, string> = {
  quemones:    'bg-orange-500',
  infieles:    'bg-pink-500',
  confesiones: 'bg-purple-600',
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

  const isAuthor = !!currentUsername && currentUsername === post.anon_id;

  const created = new Date(post.created_at);
  const timeAgo = formatDistanceToNow(created, { addSuffix: true, locale: es });
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

  const initials = post.anon_id.slice(0, 2).toUpperCase();

  return (
    <article
      style={style}
      className={`group relative bg-white border border-stone-200/80 rounded-2xl overflow-hidden hover:shadow-lg hover:border-stone-300/70 transition-all duration-200 shadow-sm shadow-stone-100/60 ${className ?? ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentBar[post.category]}`} />

      <div className="pl-5 pr-4 pt-4 pb-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm ${colorFor(post.anon_id)}`}>
              <span className="text-[10px] font-bold">{initials}</span>
            </div>
            <span className="text-stone-500 text-xs">{post.anon_id}</span>
            <CategoryPill category={post.category} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 text-[11px]">
              {timeAgo}
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
          <div className="mb-3">
            <InlineEditor
              initial={post.content}
              maxChars={500}
              saving={savingEdit}
              onCancel={() => setEditing(false)}
              onSave={handleSaveEdit}
            />
          </div>
        ) : (
          <Link href={`/posts/${post.id}`} className="block mb-3">
            <p className="text-stone-800 text-[15px] leading-relaxed break-words hover:text-stone-600 transition-colors">
              {post.content}
            </p>
          </Link>
        )}

        {post.image_webp && !editing && (
          <div className="mb-3">
            <PostImage src={post.image_webp} className="max-h-72 w-auto rounded-lg" />
          </div>
        )}

        <div className="flex items-center justify-between">
          <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} onVoted={onVoted} onError={onVoteError} />
          <div className="flex items-center gap-3">
            <Link
              href={`/posts/${post.id}`}
              className="flex items-center gap-1.5 text-stone-400 hover:text-stone-600 text-xs transition-colors"
            >
              <MessageCircle size={13} strokeWidth={1.5} />
              <span>{commentCount}</span>
            </Link>
            {!isAuthor && (
              <button
                onClick={() => setReportOpen(true)}
                className="text-stone-300 hover:text-red-400 transition-colors"
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
