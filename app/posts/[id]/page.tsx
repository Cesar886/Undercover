import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import { query } from '@/lib/db';
import { Post, PostCategory } from '@/types';
import { CategoryPill } from '@/components/CategoryPill';
import { VoteButtons } from '@/components/VoteButtons';
import { LocalComments } from '@/components/LocalComments';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

const accentBar: Record<PostCategory, string> = {
  quemones:    'bg-orange-500',
  infieles:    'bg-pink-500',
  confesiones: 'bg-purple-600',
  rumores:     'bg-blue-500',
};

export default async function PostPage({ params }: Props) {
  const postResult = await query(
    'SELECT * FROM posts WHERE id = $1 AND is_hidden = false',
    [params.id]
  );

  if (postResult.rows.length === 0) notFound();

  const post: Post = postResult.rows[0];

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  const initials = post.anon_id.slice(0, 2).toUpperCase();

  return (
    <main className="max-w-[600px] mx-auto px-4 pt-4 pb-10 space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors"
      >
        <ArrowLeft size={15} />
        Volver al feed
      </Link>

      {/* Post */}
      <article className="relative bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentBar[post.category]}`} />
        <div className="pl-5 pr-4 pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-gray-500 font-medium">{initials}</span>
              </div>
              <span className="text-gray-500 text-xs">{post.anon_id}</span>
              <CategoryPill category={post.category} />
            </div>
            <span className="text-gray-400 text-xs">{timeAgo}</span>
          </div>

          <p className="text-gray-800 text-[16px] leading-relaxed break-words">
            {post.content}
          </p>

          <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} />
        </div>
      </article>

      {/* Comments */}
      <LocalComments postId={post.id} />
    </main>
  );
}
