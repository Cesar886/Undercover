import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flag, MessageCircle } from 'lucide-react';
import { Post } from '@/types';
import { CategoryPill } from './CategoryPill';
import { VoteButtons } from './VoteButtons';

interface PostCardProps {
  post: Post;
  onReport: (id: string) => void;
}

export function PostCard({ post, onReport }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <article className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">{post.anon_id}</span>
          <CategoryPill category={post.category} />
        </div>
        <span className="text-zinc-700 text-xs">{timeAgo}</span>
      </div>

      <Link href={`/posts/${post.id}`}>
        <p className="text-zinc-100 text-sm leading-relaxed break-words">{post.content}</p>
      </Link>

      <div className="flex items-center justify-between pt-1">
        <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} />
        <div className="flex items-center gap-3">
          <Link
            href={`/posts/${post.id}`}
            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            <MessageCircle size={13} />
            <span>{post.comment_count ?? 0}</span>
          </Link>
          <button
            onClick={() => onReport(post.id)}
            className="text-zinc-600 hover:text-red-400 transition-colors"
            title="Reportar"
            aria-label="Reportar post"
          >
            <Flag size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
