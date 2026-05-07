'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, ChevronUp, ChevronDown, Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory } from '@/types';
import { CategoryPill } from '@/components/CategoryPill';
import { LocalComments } from '@/components/LocalComments';
import { PostSkeleton } from '@/components/PostSkeleton';

const voteBg: Record<PostCategory, string> = {
  quemones:    'bg-orange-50',
  infieles:    'bg-pink-50',
  confesiones: 'bg-purple-50',
  rumores:     'bg-blue-50',
};

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost]   = useState<Post | null | undefined>(undefined);
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.post) {
          setPost(data.post);
          setVotes({ up: data.post.upvotes, down: data.post.downvotes });
        } else {
          setPost(null);
        }
      })
      .catch(() => setPost(null));
  }, [id]);

  async function handleVote(type: 'up' | 'down') {
    if (voted || !post) return;
    setVoted(type);
    setVotes((prev) => ({
      up:   prev.up   + (type === 'up'   ? 1 : 0),
      down: prev.down + (type === 'down' ? 1 : 0),
    }));
    try {
      const res = await fetch(`/api/posts/${post.id}/vote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: type }),
      });
      if (res.ok) {
        const data = await res.json();
        setVotes({ up: data.votes.upvotes, down: data.votes.downvotes });
      } else {
        setVoted(null);
        setVotes({ up: post.upvotes, down: post.downvotes });
      }
    } catch {
      setVoted(null);
      setVotes({ up: post.upvotes, down: post.downvotes });
    }
  }

  if (post === undefined) {
    return (
      <main className="max-w-[740px] mx-auto px-4 pt-4 pb-10 space-y-4">
        <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
        <PostSkeleton />
      </main>
    );
  }

  if (post === null) {
    return (
      <main className="max-w-[740px] mx-auto px-4 pt-10 text-center space-y-3">
        <p className="text-gray-400 text-sm">Post no encontrado.</p>
        <Link href="/" className="text-orange-500 text-sm hover:text-orange-600 transition-colors">
          Volver al feed
        </Link>
      </main>
    );
  }

  const score   = votes.up - votes.down;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es });

  return (
    <main className="max-w-[740px] mx-auto px-4 pt-4 pb-10 space-y-3">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors"
      >
        <ArrowLeft size={14} />
        Volver al feed
      </Link>

      {/* Post — Reddit layout */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-colors">
        <div className="flex">
          {/* Vote column */}
          <div className={`w-10 flex-shrink-0 flex flex-col items-center pt-2 pb-3 gap-0.5 ${voteBg[post.category]}`}>
            <button
              onClick={() => handleVote('up')}
              disabled={!!voted}
              className={`p-1 rounded hover:bg-orange-100 transition-colors disabled:cursor-not-allowed ${
                voted === 'up' ? 'text-orange-500' : 'text-gray-300 hover:text-orange-500'
              }`}
              aria-label="Upvote"
            >
              <ChevronUp size={20} strokeWidth={2.5} />
            </button>
            <span className={`text-xs font-bold tabular-nums ${
              voted === 'up' ? 'text-orange-500' : voted === 'down' ? 'text-blue-500' : 'text-gray-700'
            }`}>
              {score}
            </span>
            <button
              onClick={() => handleVote('down')}
              disabled={!!voted}
              className={`p-1 rounded hover:bg-blue-100 transition-colors disabled:cursor-not-allowed ${
                voted === 'down' ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'
              }`}
              aria-label="Downvote"
            >
              <ChevronDown size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 px-3 pt-3 pb-2.5">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-gray-400 mb-2.5">
              <CategoryPill category={post.category} />
              <span>·</span>
              <span className="font-medium text-gray-600">{post.anon_id}</span>
              <span>·</span>
              <span>{timeAgo}</span>
            </div>

            {/* Body */}
            <p className="text-gray-900 text-[15px] leading-relaxed break-words mb-3">
              {post.content}
            </p>

            {/* Action bar */}
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <MessageCircle size={13} />
                <span>{post.comment_count ?? 0} comentarios</span>
              </span>
              <button
                onClick={() => fetch(`/api/posts/${post.id}/report`, { method: 'POST' })}
                className="flex items-center gap-1 hover:text-red-400 transition-colors"
              >
                <Flag size={13} />
                <span>Reportar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments section */}
      <div className="bg-white border border-gray-200 rounded-md">
        <LocalComments postId={post.id} />
      </div>
    </main>
  );
}
