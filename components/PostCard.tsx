import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory } from '@/types';
import { CategoryPill } from './CategoryPill';
import { VoteButtons } from './VoteButtons';

const accentBar: Record<PostCategory, string> = {
  quemones:    'bg-orange-500',
  infieles:    'bg-pink-500',
  confesiones: 'bg-purple-600',
  rumores:     'bg-blue-500',
};

interface PostCardProps {
  post: Post;
  onReport: (id: string) => void;
  onVoted?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function PostCard({ post, onReport, onVoted, style, className }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  const initials = post.anon_id.slice(0, 2).toUpperCase();

  return (
    <article
      style={style}
      className={`group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all ${className ?? ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentBar[post.category]}`} />
      <div className="pl-4 pr-4 pt-3 pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] text-gray-500 font-medium">{initials}</span>
            </div>
            <span className="text-gray-500 text-xs">{post.anon_id}</span>
            <CategoryPill category={post.category} />
          </div>
          <span className="text-gray-400 text-xs">{timeAgo}</span>
        </div>

        <Link href={`/posts/${post.id}`} className="block">
          <p className="text-gray-800 text-[15px] leading-relaxed break-words hover:text-gray-600 transition-colors">
            {post.content}
          </p>
        </Link>

        <div className="flex items-center justify-between pt-0.5">
          <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} onVoted={onVoted} />
          <div className="flex items-center gap-3">
            <Link
              href={`/posts/${post.id}`}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-xs transition-colors"
            >
              <MessageCircle size={13} />
              <span>{post.comment_count ?? 0}</span>
            </Link>
            <button
              onClick={() => onReport(post.id)}
              className="text-gray-300 hover:text-red-400 transition-colors"
              title="Reportar"
              aria-label="Reportar post"
            >
              <Flag size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
