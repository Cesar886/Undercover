import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory } from '@/types';
import { CategoryPill } from './CategoryPill';
import { VoteButtons } from './VoteButtons';
import { PostImage } from './PostImage';
import { colorFor } from '@/lib/avatar';

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
  onVoteError?: (msg: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function PostCard({ post, onReport, onVoted, onVoteError, style, className }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  const initials = post.anon_id.slice(0, 2).toUpperCase();

  return (
    <article
      style={style}
      className={`group relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all duration-200 ${className ?? ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentBar[post.category]}`} />

      <div className="pl-5 pr-4 pt-4 pb-3.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${colorFor(post.anon_id)}`}>
              <span className="text-[10px] font-bold">{initials}</span>
            </div>
            <span className="text-gray-500 text-xs">{post.anon_id}</span>
            <CategoryPill category={post.category} />
          </div>
          <span className="text-gray-400 text-[11px]">{timeAgo}</span>
        </div>

        {/* Content */}
        <Link href={`/posts/${post.id}`} className="block mb-3">
          <p className="text-gray-800 text-[15px] leading-relaxed break-words hover:text-gray-600 transition-colors">
            {post.content}
          </p>
        </Link>

        {post.image_webp && (
          <div className="mb-3">
            <PostImage src={post.image_webp} className="max-h-72 w-auto" />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} onVoted={onVoted} onError={onVoteError} />
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
