'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { apiGet } from '@/lib/apiClient';
import { Post } from '@/types';

export default function BuscarPage() {
  const [query, setQuery]         = useState('');
  const [submitted, setSubmitted] = useState('');
  const [posts, setPosts]         = useState<Post[]>([]);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const [username, setUsername]   = useState('');
  const { message, showToast }    = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setUsername(data.user?.username ?? ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!submitted) return;
    setLoading(true);
    (async () => {
      const r = await apiGet<{ posts: Post[] }>(`/api/posts?q=${encodeURIComponent(submitted)}&sort=recent&page=1`);
      if (r.ok) {
        setPosts(r.data.posts ?? []);
      } else {
        setPosts([]);
        showToast(r.error);
      }
      setSearched(true);
      setLoading(false);
    })();
  }, [submitted, showToast]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSubmitted(q);
  }

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post eliminado');
  }

  // Mantener resultados al día con el stream (votos / hidden / comentarios sobre los visibles).
  useFeedEvents(
    useCallback((ev) => {
      if (ev.type === 'post:vote') {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === ev.postId ? { ...p, upvotes: ev.upvotes, downvotes: ev.downvotes } : p
          )
        );
        return;
      }
      if (ev.type === 'post:hidden') {
        setPosts((prev) => prev.filter((p) => p.id !== ev.postId));
        return;
      }
      if (ev.type === 'comment:new') {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === ev.postId ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p
          )
        );
      }
    }, [])
  );

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <form onSubmit={handleSubmit} className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en QuemonesUM..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm"
        />
      </form>

      {loading && <div className="space-y-3"><PostSkeleton /><PostSkeleton /></div>}

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
                currentUsername={username}
                onVoted={() => showToast('Voto guardado')}
                onVoteError={(msg) => showToast(msg)}
                onDeleted={handleDeleted}
                onActionError={(msg) => showToast(msg)}
                onReported={() => showToast('Gracias, lo revisaremos.')}
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
                className="opacity-0 animate-fade-slide-in"
              />
            ))}
          </div>
        </>
      )}

      {!loading && !searched && (
        <p className="text-gray-300 text-sm text-center py-10">Escribe algo y presiona Enter</p>
      )}

      <Toast message={message} />
    </main>
  );
}
