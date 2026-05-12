'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CornerDownRight, Flag, SendHorizonal, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { AnonAvatar } from '@/components/AnonAvatar';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { ImagePicker } from '@/components/ImagePicker';
import { PostImage } from '@/components/PostImage';
import { Toast } from '@/components/Toast';
import { AuthorMenu } from '@/components/AuthorMenu';
import { InlineEditor } from '@/components/InlineEditor';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ReportDialog } from '@/components/ReportDialog';
import { useToast } from '@/hooks/useToast';
import { apiDelete, apiPatch, apiPost } from '@/lib/apiClient';
import { ReportReason } from '@/types';

interface Comment {
  id: string;
  anon_id: string;
  content: string;
  image_webp?: string | null;
  created_at: string;
  updated_at?: string | null;
  is_deleted?: boolean;
  parent_id?: string | null;
  replies?: Comment[];
  trust_score?: number;
  trust_unlocked?: boolean;
  upvotes?: number;
  downvotes?: number;
}

const MAX_CHARS = 300;
const MAX_VISUAL_DEPTH = 2;
const SOFT_DELETED_TEXT = '[Este comentario ha sido eliminado]';

function buildTree(flat: Comment[]): Comment[] {
  const seen = new Set<string>();
  const deduped = flat.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  const map = new Map<string, Comment & { replies: Comment[] }>();
  deduped.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  const roots: (Comment & { replies: Comment[] })[] = [];
  deduped.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function CharRing({ current, max }: { current: number; max: number }) {
  const remaining = max - current;
  if (remaining > 60) return null;
  const pct = Math.min(current / max, 1);
  const r = 8;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const isDanger = remaining < 10;
  const isLow = remaining < 20;
  return (
    <div className="relative w-5 h-5 flex items-center justify-center">
      <svg className="-rotate-90 absolute inset-0 w-full h-full" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r={r} fill="none" stroke="#e7e5e4" strokeWidth="2" />
        <circle
          cx="10" cy="10" r={r} fill="none"
          stroke={isDanger ? '#ef4444' : isLow ? '#d97706' : '#f97316'}
          strokeWidth="2"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.25s ease, stroke 0.25s ease' }}
        />
      </svg>
      {remaining <= 15 && (
        <span className={`relative text-[8px] font-bold tabular-nums ${isDanger ? 'text-red-500' : 'text-mauve-700'}`}>
          {remaining}
        </span>
      )}
    </div>
  );
}

function AvatarBadge({ name, size = 'sm', muted = false }: { name: string; size?: 'sm' | 'md'; muted?: boolean }) {
  return (
    <AnonAvatar
      name={name || 'AN'}
      size={size === 'md' ? 32 : 28}
      muted={muted}
      className="ring-2 ring-white shadow-sm flex-shrink-0"
    />
  );
}

function ReplyForm({
  targetAnonId,
  username,
  onSubmit,
  onCancel,
}: {
  targetAnonId: string;
  username: string;
  onSubmit: (content: string, image: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if ((!text && !image) || submitting) return;
    setSubmitting(true);
    try { await onSubmit(text, image); } finally { setSubmitting(false); }
  }

  return (
    <div className="flex gap-3 items-start animate-fade-slide-in">
      <AvatarBadge name={username || 'AN'} size="sm" />
      <form onSubmit={handleSubmit} className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-stone-400 mb-2">
          Respondiendo a{' '}
          <span className="text-mauve-600 normal-case tracking-normal text-[11px]">{targetAnonId}</span>
        </p>
        <textarea
          ref={ref}
          value={content}
          onChange={(e) => {
            setContent(e.target.value.slice(0, MAX_CHARS));
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          placeholder="Escribe tu respuesta…"
          rows={1}
          disabled={submitting}
          className="w-full text-[14px] text-stone-800 dark:text-zinc-200 placeholder-stone-300 dark:placeholder-zinc-600 bg-transparent resize-none overflow-hidden focus:outline-none py-1 disabled:opacity-60 leading-relaxed"
        />
        <div className="h-px bg-mauve-500/60 rounded-full" />
        <div className="mt-2.5">
          <ImagePicker
            preview={image}
            onPick={(d) => { setImage(d); setImageError(null); }}
            onClear={() => { setImage(null); setImageError(null); }}
            onError={(m) => setImageError(m)}
            disabled={submitting}
            uploading={submitting && !!image}
          />
          {imageError && <p className="text-red-500 text-xs mt-1">{imageError}</p>}
        </div>
        <div className="flex items-center justify-between mt-3">
          <CharRing current={content.length} max={MAX_CHARS} />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || (!content.trim() && !image)}
              className="px-4 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 active:scale-95 disabled:opacity-30 text-white rounded-full transition-all shadow-sm"
            >
              {submitting ? 'Enviando…' : 'Responder'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  depth,
  parentAnonId,
  replyingTo,
  username,
  editingId,
  onReply,
  onSubmitReply,
  onCancelReply,
  onStartEdit,
  onCancelEdit,
  onSavedEdit,
  onAskDelete,
  onAskReport,
}: {
  comment: Comment & { replies?: Comment[] };
  postId: string;
  depth: number;
  parentAnonId?: string;
  replyingTo: { id: string; anonId: string } | null;
  username: string;
  editingId: string | null;
  onReply: (id: string, anonId: string) => void;
  onSubmitReply: (parentId: string, content: string, image: string | null) => Promise<void>;
  onCancelReply: () => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSavedEdit: (id: string, content: string, updated_at: string) => void;
  onAskDelete: (id: string, hasReplies: boolean) => void;
  onAskReport: (id: string) => void;
}) {
  const created = new Date(comment.created_at);
  const timeAgo = formatDistanceToNow(created, { addSuffix: true, locale: es });
  const editedTitle = comment.updated_at
    ? `Editado el ${format(new Date(comment.updated_at), "d 'de' MMMM, HH:mm", { locale: es })}`
    : undefined;
  const isReplying = replyingTo?.id === comment.id;
  const isEditing = editingId === comment.id;
  const isAuthor = !!username && username === comment.anon_id && !comment.is_deleted;
  const hasReplies = (comment.replies?.length ?? 0) > 0;
  const [savingEdit, setSavingEdit] = useState(false);
  const [upvotes, setUpvotes] = useState(comment.upvotes ?? 0);
  const [downvotes, setDownvotes] = useState(comment.downvotes ?? 0);
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const [voting, setVoting] = useState(false);

  async function handleVote(voteType: 'up' | 'down') {
    if (voting || voted !== null || comment.is_deleted) return;
    setVoting(true);
    const r = await apiPatch<{ votes: { upvotes: number; downvotes: number } }>(
      `/api/posts/${postId}/comments/${comment.id}/vote`,
      { vote_type: voteType }
    );
    setVoting(false);
    if (r.ok) {
      setUpvotes(r.data.votes.upvotes);
      setDownvotes(r.data.votes.downvotes);
      setVoted(voteType);
    }
  }

  async function handleSaveEdit(content: string) {
    setSavingEdit(true);
    const r = await apiPatch<{ comment: Comment }>(
      `/api/posts/${postId}/comments/${comment.id}`,
      { content }
    );
    setSavingEdit(false);
    if (r.ok) {
      onSavedEdit(comment.id, r.data.comment.content, r.data.comment.updated_at ?? new Date().toISOString());
      onCancelEdit();
    }
  }

  return (
    <div>
      <div className="group flex gap-3 py-3.5 -mx-1 px-1 rounded-xl transition-colors duration-150 hover:bg-stone-50/80 dark:hover:bg-zinc-800/40">
        <div className="mt-0.5">
          <AvatarBadge name={comment.anon_id} size="sm" muted={!!comment.is_deleted} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className={`text-[13px] font-bold leading-none truncate ${comment.is_deleted ? 'text-stone-400 dark:text-zinc-500' : 'text-stone-800 dark:text-zinc-200'}`}>
                {comment.is_deleted ? '—' : comment.anon_id}
              </span>
              <span className="text-[11px] text-stone-400 dark:text-zinc-500 leading-none flex items-center">
                {!comment.is_deleted && (
                  <>
                    <Tooltip
                      label="La confianza sube con votos positivos y baja con reportes o votos negativos."
                      withArrow
                      multiline
                      w={220}
                      events={{ hover: true, focus: true, touch: true }}
                      transitionProps={{ transition: 'fade', duration: 200 }}
                      classNames={{
                        tooltip: 'bg-white dark:bg-[#18181b] text-stone-600 dark:text-zinc-300 border border-black/10 dark:border-white/10 shadow-xl text-xs rounded-xl px-3 py-2',
                        arrow: 'border-l border-t border-black/10 dark:border-white/10'
                      }}
                    >
                      <span className="font-medium cursor-help hover:text-stone-600 dark:hover:text-zinc-300 transition-colors">
                        {comment.trust_unlocked ? `[confianza ${comment.trust_score ?? 0}]` : '[confianza ?]'}
                      </span>
                    </Tooltip>
                    <span className="mx-1">·</span>
                  </>
                )}
                <span>{timeAgo}</span>
                {!comment.is_deleted && comment.updated_at && (
                  <span title={editedTitle} className="text-stone-300"> · editado</span>
                )}
              </span>
            </div>
            {!comment.is_deleted && (
              <div className="flex items-center gap-1">
                {isAuthor && !isEditing && (
                  <AuthorMenu
                    size="sm"
                    onEdit={() => onStartEdit(comment.id)}
                    onDelete={() => onAskDelete(comment.id, hasReplies)}
                  />
                )}
                {!isAuthor && username && (
                  <button
                    onClick={() => onAskReport(comment.id)}
                    className="text-stone-300 hover:text-red-400 transition-colors p-1 -m-1"
                    aria-label="Reportar comentario"
                    title="Reportar"
                  >
                    <Flag size={11} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            )}
          </div>

          {comment.is_deleted ? (
            <p className="text-[14px] italic text-stone-400 leading-relaxed">
              {SOFT_DELETED_TEXT}
            </p>
          ) : isEditing ? (
            <InlineEditor
              initial={comment.content}
              maxChars={MAX_CHARS}
              saving={savingEdit}
              onCancel={onCancelEdit}
              onSave={handleSaveEdit}
              textareaClassName="w-full text-[14px] text-stone-800 dark:text-zinc-200 placeholder-stone-300 dark:placeholder-zinc-600 bg-transparent dark:bg-zinc-800 resize-none overflow-hidden focus:outline-none border border-stone-200 dark:border-zinc-700 focus:border-mauve-500 rounded-lg px-3 py-2 leading-relaxed disabled:opacity-60"
            />
          ) : (
            <p className="text-[14px] text-stone-700 dark:text-zinc-300 leading-relaxed break-words">
              {parentAnonId && (
                <span className="text-mauve-600 font-semibold mr-1">@{parentAnonId}</span>
              )}
              {comment.content}
            </p>
          )}

          {comment.image_webp && !comment.is_deleted && !isEditing && (
            <div className="mt-2">
              <PostImage src={comment.image_webp} className="max-h-56 w-auto rounded-lg" />
            </div>
          )}

          {!comment.is_deleted && !isEditing && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleVote('up')}
                  disabled={voting || voted !== null}
                  className={`flex items-center gap-1 text-[11px] transition-colors disabled:cursor-not-allowed ${
                    voted === 'up' ? 'text-mauve-600' : 'text-stone-300 hover:text-mauve-600'
                  }`}
                  aria-label="Voto positivo"
                >
                  <ThumbsUp size={11} strokeWidth={2} />
                  {upvotes > 0 && <span>{upvotes}</span>}
                </button>
                <button
                  onClick={() => handleVote('down')}
                  disabled={voting || voted !== null}
                  className={`flex items-center gap-1 text-[11px] transition-colors disabled:cursor-not-allowed ${
                    voted === 'down' ? 'text-blue-500' : 'text-stone-300 hover:text-blue-400'
                  }`}
                  aria-label="Voto negativo"
                >
                  <ThumbsDown size={11} strokeWidth={2} />
                  {downvotes > 0 && <span>{downvotes}</span>}
                </button>
              </div>
              {username && (
                <button
                  onClick={() => (isReplying ? onCancelReply() : onReply(comment.id, comment.anon_id))}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium transition-all ${
                    isReplying
                      ? 'text-mauve-600'
                      : 'text-stone-300 group-hover:text-stone-500 hover:!text-stone-700'
                  }`}
                >
                  <CornerDownRight size={10} strokeWidth={2.5} />
                  {isReplying ? 'Cancelar' : 'Responder'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isReplying && (
        <div className="pb-3 pl-10 -mt-1">
          <ReplyForm
            targetAnonId={comment.anon_id}
            username={username}
            onSubmit={(text, img) => onSubmitReply(comment.id, text, img)}
            onCancel={onCancelReply}
          />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className={depth < MAX_VISUAL_DEPTH ? 'relative pl-6 ml-3.5' : ''}>
          {depth < MAX_VISUAL_DEPTH && (
            <div className="absolute left-0 top-1 bottom-4 w-[1.5px] bg-gradient-to-b from-mauve-400 via-mauve-100 to-transparent rounded-full" />
          )}
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply as Comment & { replies?: Comment[] }}
              postId={postId}
              depth={depth < MAX_VISUAL_DEPTH ? depth + 1 : MAX_VISUAL_DEPTH}
              parentAnonId={depth >= MAX_VISUAL_DEPTH ? comment.anon_id : undefined}
              replyingTo={replyingTo}
              username={username}
              editingId={editingId}
              onReply={onReply}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSavedEdit={onSavedEdit}
              onAskDelete={onAskDelete}
              onAskReport={onAskReport}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LocalComments({ postId, onCountChange }: { postId: string; onCountChange?: (count: number) => void }) {
  const [comments, setComments]     = useState<Comment[]>([]);
  const [content, setContent]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused]       = useState(false);
  const [username, setUsername]     = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; anonId: string } | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [image, setImage]           = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; hasReplies: boolean } | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const { message, showToast }      = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => {});
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setUsername(data.user?.username ?? ''))
      .catch(() => {});
  }, [postId]);

  useEffect(() => {
    onCountChange?.(comments.filter((c) => !c.is_deleted).length);
  }, [comments, onCountChange]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if ((!text && !image) || submitting) return;
    setSubmitting(true);
    setImageError(null);
    const result = await apiPost<{ comment: Comment }>(`/api/posts/${postId}/comments`, {
      content: text,
      image: image ?? undefined,
    });
    if (result.ok) {
      setComments((prev) => [...prev, result.data.comment]);
      setContent('');
      setImage(null);
      setFocused(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      textareaRef.current?.blur();
    } else {
      if (
        result.error.toLowerCase().includes('imagen') ||
        result.error.toLowerCase().includes('formato')
      ) {
        setImageError(result.error);
      } else {
        showToast(result.error);
      }
    }
    setSubmitting(false);
  }

  async function handleReplySubmit(parentId: string, text: string, img: string | null) {
    const result = await apiPost<{ comment: Comment }>(`/api/posts/${postId}/comments`, {
      content: text,
      parent_id: parentId,
      image: img ?? undefined,
    });
    if (result.ok) {
      setComments((prev) => [...prev, result.data.comment]);
      setReplyingTo(null);
    } else {
      showToast(result.error);
    }
  }

  function handleCancel() {
    setContent('');
    setImage(null);
    setImageError(null);
    setFocused(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    textareaRef.current?.blur();
  }

  function handleSavedEdit(id: string, newContent: string, updated_at: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, content: newContent, updated_at } : c))
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const r = await apiDelete<{ success: boolean; soft: boolean }>(
      `/api/posts/${postId}/comments/${deleteTarget.id}`
    );
    setDeleting(false);
    if (r.ok) {
      const id = deleteTarget.id;
      const soft = r.data.soft;
      setComments((prev) => {
        if (soft) {
          return prev.map((c) =>
            c.id === id ? { ...c, is_deleted: true, content: '', image_webp: null } : c
          );
        }
        return prev.filter((c) => c.id !== id);
      });
      setDeleteTarget(null);
      showToast('Comentario eliminado');
    } else {
      showToast(r.error);
    }
  }

  async function submitReport(reason: ReportReason, detail?: string) {
    if (!reportTarget) return;
    setSendingReport(true);
    const r = await apiPost(
      `/api/posts/${postId}/comments/${reportTarget}/report`,
      { reason, detail }
    );
    setSendingReport(false);
    if (r.ok) {
      setReportTarget(null);
      showToast('Gracias, lo revisaremos.');
    } else {
      showToast(r.error);
    }
  }

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'comment:new' && ev.postId === postId) {
          setComments((prev) => {
            if (prev.some((c) => c.id === ev.comment.id)) return prev;
            return [...prev, ev.comment];
          });
          return;
        }
        if (ev.type === 'comment:edited' && ev.postId === postId) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === ev.comment.id
                ? { ...c, content: ev.comment.content, updated_at: ev.comment.updated_at }
                : c
            )
          );
          return;
        }
        if (ev.type === 'comment:deleted' && ev.postId === postId) {
          setComments((prev) => {
            if (ev.soft) {
              return prev.map((c) =>
                c.id === ev.commentId
                  ? { ...c, is_deleted: true, content: '', image_webp: null }
                  : c
              );
            }
            return prev.filter((c) => c.id !== ev.commentId);
          });
        }
      },
      [postId]
    )
  );

  const tree = buildTree(comments);
  const visibleCount = comments.filter((c) => !c.is_deleted).length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/60 rounded-2xl shadow-md shadow-stone-100/80 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-stone-100 dark:border-zinc-800 flex items-center gap-2.5">
        <span className="font-display text-[15px] font-semibold text-stone-800 dark:text-zinc-200 tracking-tight">Comentarios</span>
        {visibleCount > 0 && (
          <span className="bg-mauve-100 text-mauve-700 text-[11px] font-semibold rounded-full px-2 py-0.5 leading-none">
            {visibleCount}
          </span>
        )}
      </div>

      {username ? (
        <div className={`flex gap-3 px-5 py-4 border-b border-stone-100 dark:border-zinc-800 transition-colors duration-300 ${focused ? 'bg-mauve-50/20 dark:bg-mauve-600/5' : ''}`}>
          <div className="flex-shrink-0 mt-0.5">
            <AvatarBadge name={username} size="md" />
          </div>
          <form onSubmit={handleSubmit} className="flex-1 min-w-0" aria-busy={submitting}>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value.slice(0, MAX_CHARS));
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onFocus={() => setFocused(true)}
                placeholder="Comparte tu voz…"
                rows={1}
                disabled={submitting}
                className="w-full text-[15px] text-stone-800 dark:text-zinc-200 placeholder-stone-300 dark:placeholder-zinc-600 bg-transparent resize-none overflow-hidden focus:outline-none pt-1 pb-1 pr-8 disabled:opacity-60 leading-relaxed"
              />
              {!focused && content.trim() && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="absolute right-0 top-1 text-mauve-600 hover:text-mauve-700 active:scale-90 transition-all disabled:opacity-30"
                  aria-label="Enviar"
                >
                  <SendHorizonal size={15} />
                </button>
              )}
            </div>
            <div
              className={`h-[1.5px] rounded-full transition-all duration-200 ${focused ? 'bg-mauve-500' : 'bg-stone-200 dark:bg-zinc-700'}`}
              style={focused ? { boxShadow: '0 0 6px rgba(249,115,22,0.3)' } : {}}
            />
            {focused && (
              <div className="mt-2.5 animate-fade-in">
                <ImagePicker
                  preview={image}
                  onPick={(d) => { setImage(d); setImageError(null); }}
                  onClear={() => { setImage(null); setImageError(null); }}
                  onError={(m) => setImageError(m)}
                  disabled={submitting}
                  uploading={submitting && !!image}
                />
                {imageError && <p className="text-red-500 text-xs mt-1">{imageError}</p>}
              </div>
            )}
            {focused && (
              <div className="flex items-center justify-between mt-3 animate-fade-slide-in">
                <CharRing current={content.length} max={MAX_CHARS} />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (!content.trim() && !image)}
                    className="px-4 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 active:scale-95 disabled:opacity-30 text-white rounded-full transition-all shadow-sm"
                  >
                    {submitting ? 'Enviando…' : 'Comentar'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      ) : (
        <div className="px-5 py-5 border-b border-stone-100 dark:border-zinc-800">
          <p className="font-display italic text-[15px] text-stone-500 dark:text-zinc-400 mb-3">
            Únete a la conversación.
          </p>
          <a
            href="/login"
            className="inline-flex items-center px-4 py-1.5 text-xs font-semibold bg-mauve-600 hover:bg-mauve-700 active:scale-95 text-white rounded-full transition-all shadow-sm"
          >
            Entrar
          </a>
        </div>
      )}

      {comments.length === 0 ? (
        <div className="py-14 text-center">
          <MessageSquare size={28} strokeWidth={1.5} className="mx-auto text-stone-200 dark:text-zinc-700 mb-3" />
          <p className="font-display italic text-[15px] text-stone-400 dark:text-zinc-500">Nadie ha comentado todavía.</p>
          <p className="text-xs text-stone-300 dark:text-zinc-600 mt-1">Sé el primero.</p>
        </div>
      ) : (
        <div className="px-4 py-1 divide-y divide-stone-100/80 dark:divide-zinc-800/80">
          {tree.map((c) => (
            <CommentItem
              key={c.id}
              comment={c as Comment & { replies?: Comment[] }}
              postId={postId}
              depth={0}
              replyingTo={replyingTo}
              username={username}
              editingId={editingId}
              onReply={(id, anonId) => setReplyingTo({ id, anonId })}
              onSubmitReply={handleReplySubmit}
              onCancelReply={() => setReplyingTo(null)}
              onStartEdit={(id) => setEditingId(id)}
              onCancelEdit={() => setEditingId(null)}
              onSavedEdit={handleSavedEdit}
              onAskDelete={(id, hasReplies) => setDeleteTarget({ id, hasReplies })}
              onAskReport={(id) => setReportTarget(id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="¿Eliminar comentario?"
        description={
          deleteTarget?.hasReplies
            ? 'Como el comentario tiene respuestas, el texto se reemplazará por "[Este comentario ha sido eliminado]". Las respuestas se conservan.'
            : 'Esta acción no se puede deshacer.'
        }
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <ReportDialog
        open={!!reportTarget}
        busy={sendingReport}
        onCancel={() => setReportTarget(null)}
        onSubmit={submitReport}
      />

      <Toast message={message} />
    </div>
  );
}
