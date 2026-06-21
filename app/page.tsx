'use client';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { PostForm } from '@/components/PostForm';
import { PostCard } from '@/components/PostCard';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { apiGet } from '@/lib/apiClient';
import { BOARDS } from '@/lib/boards';
import { Post } from '@/types';

interface BoardPreview {
  slug: string;
  posts: Post[];
  loading: boolean;
}

export default function Home() {
  const [previews, setPreviews] = useState<BoardPreview[]>(
    BOARDS.map((b) => ({ slug: b.slug, posts: [], loading: true }))
  );
  const { message, showToast } = useToast();

  const fetchPreview = useCallback(async (slug: string) => {
    const result = await apiGet<{ posts: Post[] }>(
      `/api/posts?category=${slug}&sort=recent&page=1`
    );
    const posts = result.ok ? (result.data.posts ?? []).slice(0, 3) : [];
    setPreviews((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, posts, loading: false } : p))
    );
  }, []);

  useEffect(() => {
    BOARDS.forEach((b) => fetchPreview(b.slug));
  }, [fetchPreview]);

  function handlePostCreated() {
    BOARDS.forEach((b) => fetchPreview(b.slug));
    showToast('Post publicado');
  }

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-6">
      <PostForm onPostCreated={handlePostCreated} />

      <div className="space-y-4">
        {BOARDS.map((board) => {
          const preview = previews.find((p) => p.slug === board.slug)!;
          return (
            <section
              key={board.slug}
              className="bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/10 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden"
            >
              {/* Board header */}
              <div className="px-4 pt-4 pb-3 flex items-baseline justify-between border-b border-black/[0.03] dark:border-violet-500/10">
                <div className="flex items-baseline gap-2">
                  <Link
                    href={`/${board.slug}`}
                    className="font-bold text-base hover:underline transition-colors"
                    style={{ color: board.text }}
                  >
                    {board.name}
                  </Link>
                  <span className="text-xs text-gray-400 dark:text-[#4a4870]">
                    {board.description}
                  </span>
                </div>
                <Link
                  href={`/${board.slug}`}
                  className="text-xs text-gray-400 dark:text-[#4a4870] hover:text-gray-600 dark:hover:text-violet-300 transition-colors whitespace-nowrap"
                >
                  Ver todos →
                </Link>
              </div>

              {/* Thread previews */}
              <div className="divide-y divide-black/[0.03] dark:divide-violet-500/10">
                {preview.loading ? (
                  <div className="px-4 py-3">
                    <PostSkeleton />
                  </div>
                ) : preview.posts.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400 dark:text-[#4a4870] text-center">
                    Sin hilos aún —{' '}
                    <Link href={`/${board.slug}`} className="underline hover:text-gray-600">
                      sé el primero
                    </Link>
                  </p>
                ) : (
                  preview.posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}`}
                      className="block px-4 py-3 hover:bg-gray-50/80 dark:hover:bg-violet-500/5 transition-colors"
                    >
                      <p className="text-sm text-gray-700 dark:text-[#c8c4ee] line-clamp-2 leading-snug">
                        {post.content || '📎 imagen'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 dark:text-[#4a4870]">
                        <span>↑{post.upvotes}</span>
                        <span>💬 {post.comment_count ?? 0}</span>
                        <span className="ml-auto">
                          {new Date(post.last_bumped_at).toLocaleDateString('es-MX', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Toast message={message} />
    </main>
  );
}
