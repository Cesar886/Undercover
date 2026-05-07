'use client';
import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Comment {
  id: string;
  anon_id: string;
  content: string;
  created_at: string;
}

const MAX_CHARS = 300;

function CommentItem({ comment }: { comment: Comment }) {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es });

  return (
    <div className="py-3 px-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-bold text-gray-800">{comment.anon_id}</span>
        <span className="text-[11px] text-gray-400">· {timeAgo}</span>
      </div>
      <p className="text-sm text-gray-800 leading-relaxed break-words">{comment.content}</p>
    </div>
  );
}

export function LocalComments({ postId }: { postId: string }) {
  const [comments, setComments]     = useState<Comment[]>([]);
  const [content, setContent]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused]       = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
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
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setContent('');
    setFocused(false);
    textareaRef.current?.blur();
  }

  const remaining = MAX_CHARS - content.length;
  const showActions = focused || content.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">
          {comments.length} comentario{comments.length !== 1 ? 's' : ''}
        </h2>
      </div>

      {/* Compose box */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="border border-gray-200 rounded overflow-hidden focus-within:border-gray-400 transition-colors">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px] text-gray-400">
            Comentar como{' '}
            <span className="font-semibold text-gray-600">Anónimo</span>
          </div>
          <form onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              onFocus={() => setFocused(true)}
              placeholder="¿Qué piensas?"
              rows={showActions ? 4 : 2}
              className="w-full px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none"
            />
            {showActions && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                {remaining < 80 ? (
                  <span className={`text-xs tabular-nums ${remaining < 20 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {remaining}
                  </span>
                ) : <span />}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-xs font-bold text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !content.trim()}
                    className="px-4 py-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-full transition-colors"
                  >
                    {submitting ? '...' : 'Comentar'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-10">
          Sin comentarios aún. Sé el primero.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </div>
      )}
    </div>
  );
}
