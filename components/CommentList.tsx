import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Comment } from '@/types';

export function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return (
      <p className="text-zinc-600 text-sm text-center py-6">
        Sin comentarios aún. Sé el primero.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-zinc-500 text-xs font-medium uppercase tracking-wide">
        {comments.length} comentario{comments.length !== 1 ? 's' : ''}
      </h2>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs">{comment.anon_id}</span>
            <span className="text-zinc-700 text-xs">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed break-words">{comment.content}</p>
        </div>
      ))}
    </div>
  );
}
