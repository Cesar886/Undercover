'use client';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAnonId } from '@/lib/localStore';

interface LocalComment {
  id: string;
  anon_id: string;
  content: string;
  created_at: string;
}

const MAX_CHARS = 300;

function loadComments(postId: string): LocalComment[] {
  try { return JSON.parse(localStorage.getItem(`comments_${postId}`) ?? '[]'); }
  catch { return []; }
}

function saveComments(postId: string, comments: LocalComment[]) {
  try { localStorage.setItem(`comments_${postId}`, JSON.stringify(comments)); }
  catch {}
}

function CommentBubble({ comment }: { comment: LocalComment }) {
  const timeAgo  = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es });
  const initials = comment.anon_id.slice(0, 2).toUpperCase();

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] text-gray-500 font-bold">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-gray-700 text-xs font-medium">{comment.anon_id}</span>
          <span className="text-gray-400 text-[11px]">{timeAgo}</span>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
          <p className="text-gray-700 text-sm leading-relaxed break-words">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}

export function LocalComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [content, setContent]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [anonId, setAnonId]     = useState('');

  useEffect(() => {
    setComments(loadComments(postId));
    setAnonId(getAnonId());
  }, [postId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      const comment: LocalComment = {
        id: crypto.randomUUID(),
        anon_id: getAnonId(),
        content: text,
        created_at: new Date().toISOString(),
      };
      setComments((prev) => {
        const next = [...prev, comment];
        saveComments(postId, next);
        return next;
      });
      setContent('');
      setSubmitting(false);
    }, 200);
  }

  const remaining = MAX_CHARS - content.length;

  return (
    <div className="space-y-5">
      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="flex gap-3 px-4 pt-3.5 pb-2">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] text-gray-500 font-bold">
              {anonId.slice(0, 2).toUpperCase() || 'AN'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 mb-1">{anonId || 'Anónimo'}</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Añade un comentario anónimo..."
              rows={2}
              className="w-full bg-transparent text-gray-900 placeholder-gray-300 text-sm leading-relaxed resize-none focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-100">
          {remaining < 80 && (
            <span className={`text-xs tabular-nums ${remaining < 20 ? 'text-amber-500' : 'text-gray-300'}`}>
              {remaining}
            </span>
          )}
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
          >
            {submitting ? '...' : 'Comentar'}
          </button>
        </div>
      </form>

      {/* List */}
      {comments.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          Sin comentarios aún. Sé el primero.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wider">
            {comments.length} comentario{comments.length !== 1 ? 's' : ''}
          </p>
          {comments.map((c) => (
            <CommentBubble key={c.id} comment={c} />
          ))}
        </div>
      )}
    </div>
  );
}
