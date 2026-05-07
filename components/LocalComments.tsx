'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CornerDownRight } from 'lucide-react';
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


function buildTree(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment & { replies: Comment[] }>();
  flat.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  const roots: (Comment & { replies: Comment[] })[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
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

  const remaining = MAX_CHARS - content.length;

  return (
    <div className="flex gap-2.5 items-start">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 ${username ? colorFor(username) : 'bg-gray-100 text-gray-400'}`}>
        {username ? username.slice(0, 2).toUpperCase() : 'AN'}
      </div>
      <form onSubmit={handleSubmit} className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 mb-1">
          Respondiendo a <span className="font-semibold text-gray-500">{targetAnonId}</span>
        </p>
        <textarea
          ref={ref}
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Escribe tu respuesta…"
          rows={2}
          disabled={submitting}
          className="w-full text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none pt-1 pb-1 disabled:opacity-60"
        />
        <div className="h-px bg-orange-400" />
        <div className="mt-2">
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
        <div className="flex items-center justify-between mt-2.5">
          <span className={`text-xs tabular-nums ${remaining < 60 ? 'opacity-100' : 'opacity-0'} ${remaining < 20 ? 'text-amber-500' : 'text-gray-400'}`}>
            {remaining}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1 text-xs font-semibold text-gray-500 rounded-full hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || (!content.trim() && !image)}
              className="px-3 py-1 text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-full transition-colors"
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
  replyingTo,
  username,
  onReply,
  onSubmitReply,
  onCancelReply,
}: {
  comment: Comment & { replies?: Comment[] };
  depth: number;
  replyingTo: { id: string; anonId: string } | null;
  username: string;
  onReply: (id: string, anonId: string) => void;
  onSubmitReply: (parentId: string, content: string, image: string | null) => Promise<void>;
  onCancelReply: () => void;
}) {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es });
  const initials = comment.anon_id.slice(0, 2).toUpperCase();
  const color = colorFor(comment.anon_id);
  const isReplying = replyingTo?.id === comment.id;
  const isDepth0 = depth === 0;

  return (
    <div>
      {/* Comment row */}
      <div className={`flex gap-3 py-3.5 hover:bg-gray-50/60 transition-colors border-b border-gray-50 ${isDepth0 ? 'px-5' : 'px-4'}`}>
        <div className={`${isDepth0 ? 'w-8 h-8' : 'w-7 h-7'} rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5 ${color}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{comment.anon_id}</span>
            <span className="text-[11px] text-gray-400">{timeAgo}</span>
          </div>
          <p className="text-[14px] text-gray-600 leading-relaxed break-words">{comment.content}</p>
          {comment.image_webp && (
            <div className="mt-2">
              <PostImage src={comment.image_webp} className="max-h-56 w-auto" />
            </div>
          )}
          {username && (
            <button
              onClick={() => (isReplying ? onCancelReply() : onReply(comment.id, comment.anon_id))}
              className={`mt-2 flex items-center gap-1 text-xs font-medium transition-colors ${
                isReplying ? 'text-orange-400' : 'text-gray-400 hover:text-orange-500'
              }`}
            >
              <CornerDownRight size={11} strokeWidth={2.5} />
              {isReplying ? 'Cancelar' : 'Responder'}
            </button>
          )}
        </div>
      </div>

      {/* Inline reply compose */}
      {isReplying && (
        <div className={`py-3 border-b border-gray-50 bg-orange-50/40 ${isDepth0 ? 'pl-16 pr-5' : 'pl-14 pr-4'}`}>
          <ReplyForm
            targetAnonId={comment.anon_id}
            username={username}
            onSubmit={(text, img) => onSubmitReply(comment.id, text, img)}
            onCancel={onCancelReply}
          />
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="border-l-2 border-gray-100 ml-11">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply as Comment & { replies?: Comment[] }}
              depth={depth + 1}
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
      .then((data) => {
        const list = data.comments ?? [];
        setComments(list);
        onCountChange?.(list.length);
      })
      .catch(() => {});
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setUsername(data.user?.username ?? ''))
      .catch(() => {});
  }, [postId, onCountChange]);

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
      setComments((prev) => {
        const next = [...prev, result.data.comment];
        onCountChange?.(next.length);
        return next;
      });
      setContent('');
      setImage(null);
      setFocused(false);
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
      setComments((prev) => {
        const next = [...prev, result.data.comment];
        onCountChange?.(next.length);
        return next;
      });
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
    textareaRef.current?.blur();
  }

  // Comentarios de otros usuarios llegan por SSE — dedup por id (incluyendo el caso del autor
  // que ya lo añadió localmente al recibir la respuesta de su POST).
  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type !== 'comment:new' || ev.postId !== postId) return;
        setComments((prev) => {
          if (prev.some((c) => c.id === ev.comment.id)) return prev;
          const next = [...prev, ev.comment];
          onCountChange?.(next.length);
          return next;
        });
      },
      [postId, onCountChange]
    )
  );

  const remaining = MAX_CHARS - content.length;
  const tree = buildTree(comments);

  return (
    <div>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">
          {comments.length === 0
            ? 'Sin comentarios'
            : `${comments.length} comentario${comments.length !== 1 ? 's' : ''}`}
        </h2>
      </div>

      {/* Compose */}
      {username ? (
        <div className="flex gap-3.5 px-5 py-4 border-b border-gray-100">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[11px] ${colorFor(username)}`}>
            {username.slice(0, 2).toUpperCase()}
          </div>
          <form onSubmit={handleSubmit} className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              onFocus={() => setFocused(true)}
              placeholder="Escribe un comentario…"
              rows={focused ? 4 : 1}
              disabled={submitting}
              className="w-full text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none pt-1.5 pb-1 transition-all duration-150 disabled:opacity-60"
            />
            <div className={`h-px transition-colors duration-150 ${focused ? 'bg-orange-400' : 'bg-gray-200'}`} />
            {focused && (
              <div className="mt-2">
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
              <div className="flex items-center justify-between mt-3">
                <span className={`text-xs tabular-nums transition-opacity ${remaining < 60 ? 'opacity-100' : 'opacity-0'} ${remaining < 20 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {remaining}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-1.5 text-xs font-semibold text-gray-500 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (!content.trim() && !image)}
                    className="px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-full transition-colors"
                  >
                    {submitting ? 'Enviando…' : 'Comentar'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      ) : (
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            Inicia sesión para dejar un comentario.
          </p>
          <a
            href="/login"
            className="flex-shrink-0 px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-colors"
          >
            Iniciar sesión
          </a>
        </div>
      )}

      {/* Comments tree */}
      {comments.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Sé el primero en comentar.
        </div>
      ) : (
        <div>
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
