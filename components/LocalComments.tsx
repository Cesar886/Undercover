'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CornerDownRight, SendHorizonal, MessageSquare } from 'lucide-react';
import { colorFor } from '@/lib/avatar';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { ImagePicker } from '@/components/ImagePicker';
import { PostImage } from '@/components/PostImage';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { apiPost } from '@/lib/apiClient';

interface Comment {
  id: string;
  anon_id: string;
  content: string;
  image_webp?: string | null;
  created_at: string;
  parent_id: string | null;
  replies?: Comment[];
}

const MAX_CHARS = 300;
const MAX_VISUAL_DEPTH = 2;

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
        <span className={`relative text-[8px] font-bold tabular-nums ${isDanger ? 'text-red-500' : 'text-amber-600'}`}>
          {remaining}
        </span>
      )}
    </div>
  );
}

function AvatarBadge({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const color = colorFor(name || 'AN');
  const initials = (name || 'AN').slice(0, 2).toUpperCase();
  return (
    <div className={`${size === 'md' ? 'w-8 h-8 text-[11px]' : 'w-7 h-7 text-[10px]'} rounded-full flex items-center justify-center font-bold flex-shrink-0 ring-2 ring-white shadow-sm ${color}`}>
      {initials}
    </div>
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
          <span className="text-orange-500 normal-case tracking-normal text-[11px]">{targetAnonId}</span>
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
          className="w-full text-[14px] text-stone-800 placeholder-stone-300 resize-none overflow-hidden focus:outline-none py-1 disabled:opacity-60 leading-relaxed"
        />
        <div className="h-px bg-orange-400/60 rounded-full" />
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
  depth,
  parentAnonId,
  replyingTo,
  username,
  onReply,
  onSubmitReply,
  onCancelReply,
}: {
  comment: Comment & { replies?: Comment[] };
  depth: number;
  parentAnonId?: string;
  replyingTo: { id: string; anonId: string } | null;
  username: string;
  onReply: (id: string, anonId: string) => void;
  onSubmitReply: (parentId: string, content: string, image: string | null) => Promise<void>;
  onCancelReply: () => void;
}) {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es });
  const isReplying = replyingTo?.id === comment.id;

  return (
    <div>
      <div className="group flex gap-3 py-3.5 -mx-1 px-1 rounded-xl transition-colors duration-150 hover:bg-stone-50/80">
        <div className="mt-0.5">
          <AvatarBadge name={comment.anon_id} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[13px] font-bold text-stone-800 leading-none">{comment.anon_id}</span>
            <span className="text-[11px] text-stone-400 leading-none">{timeAgo}</span>
          </div>

          <p className="text-[14px] text-stone-700 leading-relaxed break-words">
            {parentAnonId && (
              <span className="text-orange-500 font-semibold mr-1">@{parentAnonId}</span>
            )}
            {comment.content}
          </p>

          {comment.image_webp && (
            <div className="mt-2">
              <PostImage src={comment.image_webp} className="max-h-56 w-auto rounded-lg" />
            </div>
          )}

          {username && (
            <button
              onClick={() => (isReplying ? onCancelReply() : onReply(comment.id, comment.anon_id))}
              className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium transition-all ${
                isReplying
                  ? 'text-orange-500'
                  : 'text-stone-300 group-hover:text-stone-500 hover:!text-stone-700'
              }`}
            >
              <CornerDownRight size={10} strokeWidth={2.5} />
              {isReplying ? 'Cancelar' : 'Responder'}
            </button>
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
            <div className="absolute left-0 top-1 bottom-4 w-[1.5px] bg-gradient-to-b from-orange-300 via-orange-100 to-transparent rounded-full" />
          )}
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply as Comment & { replies?: Comment[] }}
              depth={depth < MAX_VISUAL_DEPTH ? depth + 1 : MAX_VISUAL_DEPTH}
              parentAnonId={depth >= MAX_VISUAL_DEPTH ? comment.anon_id : undefined}
              replyingTo={replyingTo}
              username={username}
              onReply={onReply}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
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
  const [image, setImage]           = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
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
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

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

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type !== 'comment:new' || ev.postId !== postId) return;
        setComments((prev) => {
          if (prev.some((c) => c.id === ev.comment.id)) return prev;
          return [...prev, ev.comment];
        });
      },
      [postId]
    )
  );

  const tree = buildTree(comments);

  return (
    <div className="bg-white border border-stone-200/80 rounded-2xl shadow-md shadow-stone-100/80 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2.5">
        <span className="font-display text-[15px] font-semibold text-stone-800 tracking-tight">Comentarios</span>
        {comments.length > 0 && (
          <span className="bg-orange-100 text-orange-600 text-[11px] font-semibold rounded-full px-2 py-0.5 leading-none">
            {comments.length}
          </span>
        )}
      </div>

      {/* Compose */}
      {username ? (
        <div className={`flex gap-3 px-5 py-4 border-b border-stone-100 transition-colors duration-300 ${focused ? 'bg-amber-50/20' : ''}`}>
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
                className="w-full text-[15px] text-stone-800 placeholder-stone-300 resize-none overflow-hidden focus:outline-none pt-1 pb-1 pr-8 disabled:opacity-60 leading-relaxed"
              />
              {!focused && content.trim() && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="absolute right-0 top-1 text-orange-500 hover:text-orange-600 active:scale-90 transition-all disabled:opacity-30"
                  aria-label="Enviar"
                >
                  <SendHorizonal size={15} />
                </button>
              )}
            </div>
            <div
              className={`h-[1.5px] rounded-full transition-all duration-200 ${focused ? 'bg-orange-400' : 'bg-stone-200'}`}
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
        <div className="px-5 py-5 border-b border-stone-100">
          <p className="font-display italic text-[15px] text-stone-500 mb-3">
            Únete a la conversación.
          </p>
          <a
            href="/login"
            className="inline-flex items-center px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-full transition-all shadow-sm"
          >
            Entrar
          </a>
        </div>
      )}

      {/* Comments tree */}
      {comments.length === 0 ? (
        <div className="py-14 text-center">
          <MessageSquare size={28} strokeWidth={1.5} className="mx-auto text-stone-200 mb-3" />
          <p className="font-display italic text-[15px] text-stone-400">Nadie ha comentado todavía.</p>
          <p className="text-xs text-stone-300 mt-1">Sé el primero.</p>
        </div>
      ) : (
        <div className="px-4 py-1 divide-y divide-stone-100/80">
          {tree.map((c) => (
            <CommentItem
              key={c.id}
              comment={c as Comment & { replies?: Comment[] }}
              depth={0}
              replyingTo={replyingTo}
              username={username}
              onReply={(id, anonId) => setReplyingTo({ id, anonId })}
              onSubmitReply={handleReplySubmit}
              onCancelReply={() => setReplyingTo(null)}
            />
          ))}
        </div>
      )}
      <Toast message={message} />
    </div>
  );
}
