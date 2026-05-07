'use client';
import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CornerDownRight } from 'lucide-react';

interface Comment {
  id: string;
  anon_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  replies?: Comment[];
}

const MAX_CHARS = 300;

const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-600',
  'bg-sky-100 text-sky-600',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-600',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-600',
  'bg-fuchsia-100 text-fuchsia-600',
];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

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
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try { await onSubmit(text); } finally { setSubmitting(false); }
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
          className="w-full text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none pt-1 pb-1"
        />
        <div className="h-px bg-orange-400" />
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
              disabled={submitting || !content.trim()}
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
  onSubmitReply: (parentId: string, content: string) => Promise<void>;
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
          <button
            onClick={() => (isReplying ? onCancelReply() : onReply(comment.id, comment.anon_id))}
            className={`mt-2 flex items-center gap-1 text-xs font-medium transition-colors ${
              isReplying ? 'text-orange-400' : 'text-gray-400 hover:text-orange-500'
            }`}
          >
            <CornerDownRight size={11} strokeWidth={2.5} />
            {isReplying ? 'Cancelar' : 'Responder'}
          </button>
        </div>
      </div>

      {/* Inline reply compose */}
      {isReplying && (
        <div className={`py-3 border-b border-gray-50 bg-orange-50/40 ${isDepth0 ? 'pl-16 pr-5' : 'pl-14 pr-4'}`}>
          <ReplyForm
            targetAnonId={comment.anon_id}
            username={username}
            onSubmit={(text) => onSubmitReply(comment.id, text)}
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

export function LocalComments({ postId }: { postId: string }) {
  const [comments, setComments]     = useState<Comment[]>([]);
  const [content, setContent]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused]       = useState(false);
  const [username, setUsername]     = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; anonId: string } | null>(null);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setContent('');
        setFocused(false);
        textareaRef.current?.blur();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReplySubmit(parentId: string, text: string) {
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, parent_id: parentId }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setReplyingTo(null);
    }
  }

  function handleCancel() {
    setContent('');
    setFocused(false);
    textareaRef.current?.blur();
  }

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
      <div className="flex gap-3.5 px-5 py-4 border-b border-gray-100">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[11px] ${username ? colorFor(username) : 'bg-gray-100 text-gray-400'}`}>
          {username ? username.slice(0, 2).toUpperCase() : 'AN'}
        </div>
        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            onFocus={() => setFocused(true)}
            placeholder="Escribe un comentario…"
            rows={focused ? 4 : 1}
            className="w-full text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none pt-1.5 pb-1 transition-all duration-150"
          />
          <div className={`h-px transition-colors duration-150 ${focused ? 'bg-orange-400' : 'bg-gray-200'}`} />
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
                  disabled={submitting || !content.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-full transition-colors"
                >
                  {submitting ? 'Enviando…' : 'Comentar'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

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
    </div>
  );
}
