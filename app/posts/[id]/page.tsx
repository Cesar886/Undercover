'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory } from '@/types';
import { CategoryPill } from '@/components/CategoryPill';
import { VoteButtons } from '@/components/VoteButtons';
import { LocalComments } from '@/components/LocalComments';
import { PostSkeleton } from '@/components/PostSkeleton';

const accentBar: Record<PostCategory, string> = {
  quemones:    'bg-orange-500',
  infieles:    'bg-pink-500',
  confesiones: 'bg-purple-600',
  rumores:     'bg-blue-500',
};

const avatarColors: Record<PostCategory, string> = {
  quemones:    'bg-orange-100 text-orange-600',
  infieles:    'bg-pink-100 text-pink-600',
  confesiones: 'bg-purple-100 text-purple-700',
  rumores:     'bg-blue-100 text-blue-600',
};

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then((r) => r.json())
      .then((data) => setPost(data.post ?? null))
      .catch(() => setPost(null));
  }, [id]);

  if (post === undefined) {
    return (
      <main className="max-w-[680px] mx-auto px-4 pt-6 pb-16 space-y-5">
        <div className="h-4 w-20 rounded-full bg-gray-100 animate-pulse" />
        <PostSkeleton />
      </main>
    );
  }

  if (post === null) {
    return (
      <main className="max-w-[680px] mx-auto px-4 pt-20 text-center space-y-3">
        <p className="text-gray-400 text-sm">Post no encontrado.</p>
        <Link href="/" className="text-orange-500 text-sm hover:underline">
          Volver al feed
        </Link>
      </main>
    );
  }

  const timeAgo  = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es });
  const initials = post.anon_id.slice(0, 2).toUpperCase();

  return (
    <main className="max-w-[680px] mx-auto px-4 pt-6 pb-16 space-y-4">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        Volver al feed
      </Link>

      {/* Post card */}
      <article className="relative bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Category accent */}
        <div className={`absolute inset-y-0 left-0 w-1 ${accentBar[post.category]}`} />

        <div className="pl-6 pr-5 pt-5 pb-4 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${avatarColors[post.category]}`}>
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{post.anon_id}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CategoryPill category={post.category} />
                </div>
              </div>
            </div>
            <time className="text-xs text-gray-400 flex-shrink-0">{timeAgo}</time>
          </div>

          {/* Content */}
          <p className="text-gray-800 text-[17px] leading-relaxed break-words">
            {post.content}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-50">
            <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} />
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <MessageCircle size={13} />
                {post.comment_count ?? 0}
              </span>
              <button
                onClick={() => fetch(`/api/posts/${post.id}/report`, { method: 'POST' })}
                className="flex items-center gap-1.5 hover:text-red-400 transition-colors"
              >
                <Flag size={13} />
                Reportar
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Comments */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <LocalComments postId={post.id} />
      </section>
    </main>
  );
}
