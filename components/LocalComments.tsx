'use client';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface LocalComment {
  id: string;
  anon_id: string;
  content: string;
  created_at: string;
}

const MAX_CHARS = 300;
const ANON_KEY = 'local_anon_id';

function getAnonId(): string {
  try {
    const stored = localStorage.getItem(ANON_KEY);
    if (stored) return stored;
    const id = `Anónimo #${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(ANON_KEY, id);
    return id;
  } catch {
    return 'Anónimo';
  }
}

function loadComments(postId: string): LocalComment[] {
  try {
    return JSON.parse(localStorage.getItem(`comments_${postId}`) ?? '[]');
  } catch {
    return [];
  }
}

function saveComments(postId: string, comments: LocalComment[]) {
  try {
    localStorage.setItem(`comments_${postId}`, JSON.stringify(comments));
  } catch {}
}

function CommentBubble({ comment }: { comment: LocalComment }) {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: es,
  });
  const initials = comment.anon_id.slice(0, 2).toUpperCase();

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] text-gray-500 font-medium">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gray-600 text-xs font-medium">{comment.anon_id}</span>
          <span className="text-gray-400 text-xs">{timeAgo}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl rounded-tl-sm px-3 py-2">
          <p className="text-gray-700 text-sm leading-relaxed break-words">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}

export function LocalComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setComments(loadComments(postId));
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
      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Añade un comentario anónimo..."
          rows={2}
          className="w-full bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 border border-gray-100"
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${remaining < 30 ? 'text-amber-500' : 'text-gray-400'}`}>
            {remaining} restantes
          </span>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            {submitting ? 'Enviando...' : 'Comentar'}
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
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
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
