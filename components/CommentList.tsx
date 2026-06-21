import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Comment } from '@/types';
import { PostImage } from './PostImage';

export function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return (
      <p className="text-gray-400 text-sm text-center py-6">
        Sin comentarios aún. Sé el primero.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">
        {comments.length} comentario{comments.length !== 1 ? 's' : ''}
      </h2>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="bg-white border border-gray-200 rounded-lg p-3 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">{comment.anon_id}</span>
            <span className="text-gray-400 text-xs">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed break-words">{comment.content}</p>
          {comment.image_webp && (
            <PostImage src={comment.image_webp} />
          )}
        </div>
      ))}
    </div>
  );
}
