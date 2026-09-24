'use client';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { PostForm } from '@/components/PostForm';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { apiGet } from '@/lib/apiClient';
import { Post } from '@/types';
import { QuemaCountdown } from '@/components/QuemaCountdown';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { RulesCard } from '@/components/RulesCard';
import { CreateCategory } from '@/components/CreateCategory';
import { useCategories } from '@/hooks/useCategories';
import { toBoard } from '@/lib/boards';
import type { Category } from '@/lib/categories';

interface BoardPreview {
  slug: string;
  posts: Post[];
  loading: boolean;
}

export default function Home() {
  const { categories, refresh: refreshCategories } = useCategories();
  const [previews, setPreviews] = useState<BoardPreview[]>([]);
  const { message, showToast } = useToast();

  const fetchPreview = useCallback(async (slug: string) => {
    const result = await apiGet<{ posts: Post[] }>(`/api/posts?category=${encodeURIComponent(slug)}&sort=recent&page=1`);
    const posts = result.ok ? (result.data.posts ?? []).slice(0, 3) : [];
    setPreviews((current) => {
      const existing = current.find((preview) => preview.slug === slug);
      if (!existing) return [...current, { slug, posts, loading: false }];
      return current.map((preview) => preview.slug === slug ? { ...preview, posts, loading: false } : preview);
    });
  }, []);

  useEffect(() => {
    setPreviews((current) => categories.map((category) => {
      const existing = current.find((preview) => preview.slug === category.slug);
      return existing ?? { slug: category.slug, posts: [], loading: true };
    }));
    categories.forEach((category) => fetchPreview(category.slug));
  }, [categories, fetchPreview]);

  function handlePostCreated() {
    categories.forEach((category) => fetchPreview(category.slug));
    showToast('Post publicado');
  }

  async function handleCategoryCreated(category: Category) {
    const board = toBoard(category);
    setPreviews((current) => [...current, { slug: board.slug, posts: [], loading: false }]);
    await refreshCategories();
    showToast(`Categoría “${category.name}” creada`);
  }

  useFeedEvents(useCallback((event) => {
    if (event.type === 'post:visibility') {
      setPreviews((current) => current.map((preview) => ({
        ...preview,
        posts: preview.posts
          .filter((post) => !(post.id === event.postId && event.hidden && !post.is_owner))
          .map((post) => post.id === event.postId ? { ...post, owner_hidden: event.hidden } : post),
      })));
      return;
    }
    if (event.type === 'quema:total') {
      setPreviews((current) => current.map((preview) => ({ ...preview, posts: [], loading: false })));
      showToast('🔥 Borrado Total');
    }
  }, [showToast]));

  return (
    <main className="max-w-[600px] lg:max-w-[900px] mx-auto px-4 py-6 lg:grid lg:grid-cols-[minmax(0,600px)_260px] lg:items-start lg:gap-5">
      <div className="space-y-4">
        <div className="space-y-1">
          <PostForm onPostCreated={handlePostCreated} categories={categories} />
          <QuemaCountdown />
        </div>

        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-sm font-bold text-gray-800 dark:text-[#e9e5ff]">Categorías</h1>
            <p className="text-[11px] text-gray-400">Las originales son permanentes.</p>
          </div>
          <CreateCategory onCreated={handleCategoryCreated} />
        </div>

        <div className="space-y-4">
          {categories.map((board) => {
            const preview = previews.find((item) => item.slug === board.slug) ?? { slug: board.slug, posts: [], loading: true };
            return (
              <section key={board.slug} className="bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/10 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-baseline justify-between border-b border-black/[0.03] dark:border-violet-500/10">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <Link href={`/${board.slug}`} className="font-bold text-base hover:underline" style={{ color: board.text }}>
                      {board.name}
                    </Link>
                    {board.isSystem && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-gray-400 dark:bg-violet-500/10">Oficial</span>}
                    <span className="truncate text-xs text-gray-400 dark:text-[#4a4870]">{board.description}</span>
                  </div>
                  <Link href={`/${board.slug}`} className="ml-2 whitespace-nowrap text-xs text-gray-400 hover:text-gray-600 dark:text-[#4a4870] dark:hover:text-violet-300">Ver todos →</Link>
                </div>
                <div className="divide-y divide-black/[0.03] dark:divide-violet-500/10">
                  {preview.loading ? (
                    <div className="px-4 py-3"><PostSkeleton /></div>
                  ) : preview.posts.length === 0 ? (
                    <p className="px-4 py-4 text-center text-xs text-gray-400 dark:text-[#4a4870]">
                      Sin hilos aún — <Link href={`/${board.slug}`} className="underline hover:text-gray-600">sé el primero</Link>
                    </p>
                  ) : preview.posts.map((post) => (
                    <Link key={post.id} href={`/posts/${post.id}`} className="block px-4 py-3 transition-colors hover:bg-gray-50/80 dark:hover:bg-violet-500/5">
                      <p className="line-clamp-2 text-sm leading-snug text-gray-700 dark:text-[#c8c4ee]">{post.content || '📎 imagen'}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400 dark:text-[#4a4870]">
                        <span>↑{post.upvotes}</span><span>💬 {post.comment_count ?? 0}</span>
                        <span className="ml-auto">{new Date(post.last_bumped_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <Toast message={message} />
      </div>
      <div className="mt-6 lg:mt-0"><RulesCard /></div>
    </main>
  );
}
