import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import { query } from '@/lib/db';
import { Post, Comment } from '@/types';
import { CategoryPill } from '@/components/CategoryPill';
import { VoteButtons } from '@/components/VoteButtons';
import { CommentList } from '@/components/CommentList';
import { CommentForm } from '@/components/CommentForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function PostPage({ params }: Props) {
  const [postResult, commentsResult] = await Promise.all([
    query('SELECT * FROM posts WHERE id = $1 AND is_hidden = false', [params.id]),
    query('SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC', [params.id]),
  ]);

  if (postResult.rows.length === 0) notFound();

  const post: Post = postResult.rows[0];
  const comments: Comment[] = commentsResult.rows;

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <main className="max-w-[600px] mx-auto px-4 pt-4 pb-6 space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors"
      >
        <ArrowLeft size={15} />
        Volver al feed
      </Link>

      <article className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">{post.anon_id}</span>
            <CategoryPill category={post.category} />
          </div>
          <span className="text-gray-400 text-xs">{timeAgo}</span>
        </div>
        <p className="text-gray-800 leading-relaxed break-words">{post.content}</p>
        <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} />
      </article>

      <section className="space-y-4">
        <CommentForm postId={post.id} />
        <CommentList comments={comments} />
      </section>
    </main>
  );
}
