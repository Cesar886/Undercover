'use client';
import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Post } from '@/types';

export default function BuscarPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { message, showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!submitted) return;
    setLoading(true);
    setSearched(false);
    fetch(`/api/posts?q=${encodeURIComponent(submitted)}&sort=recent`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts ?? []);
        setSearched(true);
      })
      .finally(() => setLoading(false));
  }, [submitted]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSubmitted(q);
  }

  async function handleReport(postId: string) {
    await fetch(`/api/posts/${postId}/report`, { method: 'POST' });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post reportado');
  }

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <form onSubmit={handleSubmit} className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en QuemadosUM..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm"
        />
      </form>

      {loading && (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      )}

      {!loading && searched && posts.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">
          Sin resultados para &ldquo;{submitted}&rdquo;
        </p>
      )}

      {!loading && posts.length > 0 && (
        <>
          <p className="text-gray-400 text-xs">
            {posts.length} resultado{posts.length !== 1 ? 's' : ''} para &ldquo;{submitted}&rdquo;
          </p>
          <div className="space-y-3">
            {posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                onReport={handleReport}
                onVoted={() => showToast('Voto guardado')}
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
                className="opacity-0 animate-fade-slide-in"
              />
            ))}
          </div>
        </>
      )}

      {!loading && !searched && (
        <p className="text-gray-300 text-sm text-center py-10">
          Escribe algo y presiona Enter
        </p>
      )}

      <Toast message={message} />
    </main>
  );
}
