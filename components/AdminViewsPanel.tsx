'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, MessageCircle, RefreshCw } from 'lucide-react';

type Sort = 'views' | 'recent';

interface AdminCommentView {
  id: string;
  content: string;
  created_at: string;
  views: number;
}

interface AdminPostView {
  id: string;
  content: string;
  category: string;
  image_webp: string | null;
  created_at: string;
  views: number;
  comments: AdminCommentView[];
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function titleFrom(content: string) {
  const clean = content.trim();
  return clean.length > 90 ? clean.slice(0, 90) + '...' : clean || 'Sin texto';
}

export function AdminViewsPanel() {
  const [posts, setPosts] = useState<AdminPostView[]>([]);
  const [sort, setSort] = useState<Sort>('views');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/image-admin/views?sort=' + sort, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.replace('/imagenes-dnewjlfe99474ef8wu-admin/login');
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json() as { posts: AdminPostView[] };
      setPosts(data.posts);
    } catch {
      setError('No se pudieron cargar las visitas.');
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="mb-8 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-[0_16px_50px_rgba(60,42,86,0.08)] dark:border-violet-400/15 dark:bg-[#0b0916]">
      <div className="flex flex-col gap-4 border-b border-black/[0.05] px-5 py-5 dark:border-violet-400/10 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-mauve-600 dark:text-violet-400">Privado</p>
          <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-[#f0edff]">Visitas por publicacion</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-[#777294]">Visible solo con sesion de administracion.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-violet-400/15 dark:bg-white/[0.025]">
            <button onClick={() => setSort('views')} className={`h-8 rounded-lg px-3 text-xs font-semibold ${sort === 'views' ? 'bg-violet-600 text-white' : 'text-stone-500 dark:text-[#a7a1c2]'}`}>Mas vistos</button>
            <button onClick={() => setSort('recent')} className={`h-8 rounded-lg px-3 text-xs font-semibold ${sort === 'recent' ? 'bg-violet-600 text-white' : 'text-stone-500 dark:text-[#a7a1c2]'}`}>Mas recientes</button>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 px-3.5 text-xs font-semibold text-stone-600 disabled:opacity-50 dark:border-violet-400/15 dark:text-[#a7a1c2]">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refrescar
          </button>
        </div>
      </div>

      {error && <p className="px-5 py-4 text-sm text-red-600 dark:text-red-300 sm:px-7">{error}</p>}
      {loading ? (
        <div className="space-y-3 p-5 sm:p-7">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-stone-100 dark:bg-violet-500/10" />)}
        </div>
      ) : posts.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-stone-500 dark:text-[#777294] sm:px-7">Todavia no hay publicaciones para medir.</p>
      ) : (
        <div className="divide-y divide-stone-100 dark:divide-violet-400/10">
          {posts.map((post) => (
            <article key={post.id} className="px-5 py-4 sm:px-7">
              <div className="flex gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 dark:bg-white/[0.04]">
                  {post.image_webp ? <img src={post.image_webp} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-stone-300"><Eye size={18} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-stone-800 dark:text-[#e9e5ff]">{titleFrom(post.content)}</p>
                      <p className="mt-1 text-[11px] text-stone-400">{post.category} · {dateLabel(post.created_at)}</p>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">
                      <Eye size={13} />{post.views}
                    </div>
                  </div>
                  {post.comments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="flex items-start justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2 dark:bg-white/[0.025]">
                          <p className="line-clamp-2 text-xs text-stone-600 dark:text-[#aaa4c4]">{titleFrom(comment.content)}</p>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-stone-500 dark:text-[#8f88ad]">
                            <MessageCircle size={12} />{comment.views}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
