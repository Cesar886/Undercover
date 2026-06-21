# Tablones Board Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page category-filter layout with a 4chan-style board index plus individual board pages at `/general`, `/quemones`, `/infieles`, `/confesiones`.

**Architecture:** Add `lib/boards.ts` as the single source of truth for board metadata. The main page (`/`) becomes a board index showing a PostForm plus 3-thread previews per board. Each board gets a dynamic route `app/[board]/page.tsx` that shows a full thread list sorted by bump order. `PostForm` gains `defaultCategory` and `lockedCategory` props so board pages can lock the selector.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, existing `/api/posts` endpoint.

## Global Constraints

- No new API endpoints — consume existing `/api/posts?category=X&sort=recent&page=N`
- TypeScript strict — no `any`
- No changes to DB or API layer
- Thread lists always sorted by `last_bumped_at DESC` (bump order) — no sort selector on board pages
- `app/[board]/page.tsx` returns `notFound()` for unknown slugs (Next.js static routes take priority, so `/buscar`, `/archivo`, etc. are unaffected)

---

### Task 1: Board metadata module

**Files:**
- Create: `lib/boards.ts`

**Interfaces:**
- Produces: `Board` type, `BOARDS` array, `isValidBoard(s: string): s is PostCategory`

- [ ] **Step 1: Create `lib/boards.ts`**

```typescript
import { PostCategory } from '@/types';

export interface Board {
  slug: PostCategory;
  name: string;
  description: string;
  bg: string;
  border: string;
  text: string;
  glow: string;
}

export const BOARDS: Board[] = [
  {
    slug: 'general',
    name: 'General',
    description: 'Cualquier cosa que pase en la U',
    bg: 'rgba(100,116,139,0.07)',
    border: '#94a3b8',
    text: '#475569',
    glow: '0 0 0 1px #94a3b840, 0 2px 10px rgba(148,163,184,0.30)',
  },
  {
    slug: 'quemones',
    name: 'Quemones',
    description: 'Dramas, quemas y chismes universitarios',
    bg: 'rgba(249,115,22,0.07)',
    border: '#f97316',
    text: '#ea580c',
    glow: '0 0 0 1px #f9731630, 0 2px 10px rgba(249,115,22,0.28)',
  },
  {
    slug: 'infieles',
    name: 'Infieles',
    description: 'Lo que pasa cuando nadie está mirando',
    bg: 'rgba(236,72,153,0.07)',
    border: '#ec4899',
    text: '#db2777',
    glow: '0 0 0 1px #ec489930, 0 2px 10px rgba(236,72,153,0.28)',
  },
  {
    slug: 'confesiones',
    name: 'Confesiones',
    description: 'Lo que no le dirías a nadie en persona',
    bg: 'rgba(147,51,234,0.07)',
    border: '#9333ea',
    text: '#7e22ce',
    glow: '0 0 0 1px #9333ea30, 0 2px 10px rgba(147,51,234,0.28)',
  },
];

const VALID_SLUGS = new Set<string>(BOARDS.map((b) => b.slug));

export function isValidBoard(s: string): s is PostCategory {
  return VALID_SLUGS.has(s);
}

export function getBoard(slug: string): Board | undefined {
  return BOARDS.find((b) => b.slug === slug);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/daniel/QuemadosUm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `lib/boards.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/boards.ts
git commit -m "feat: add boards metadata module"
```

---

### Task 2: Extend PostForm with defaultCategory and lockedCategory props

**Files:**
- Modify: `components/PostForm.tsx`

**Interfaces:**
- Consumes: `Board` from `lib/boards.ts` (not imported — uses existing `PostCategory`)
- Produces: `PostFormProps` with `defaultCategory?: PostCategory`, `lockedCategory?: boolean`

- [ ] **Step 1: Add props to PostFormProps interface**

In `components/PostForm.tsx`, replace:

```typescript
interface PostFormProps {
  onPostCreated: () => void;
}
```

with:

```typescript
interface PostFormProps {
  onPostCreated: () => void;
  defaultCategory?: PostCategory;
  lockedCategory?: boolean;
}
```

- [ ] **Step 2: Use defaultCategory in component signature and state**

Replace:

```typescript
export function PostForm({ onPostCreated }: PostFormProps) {
```

with:

```typescript
export function PostForm({ onPostCreated, defaultCategory = 'general', lockedCategory = false }: PostFormProps) {
```

Replace:

```typescript
  const [category, setCategory] = useState<PostCategory>('general');
```

with:

```typescript
  const [category, setCategory] = useState<PostCategory>(defaultCategory);
```

- [ ] **Step 3: Conditionally hide the category selector row**

Find the category selector div (starts with `<div className="overflow-x-auto flex-1 min-w-0"`). Wrap the entire scrollable pill row with a conditional:

```typescript
{!lockedCategory && (
  <div className="overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
    <div className="flex gap-1.5 w-max">
      {CATEGORIES.map((c) => {
        const active = category === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            style={
              active
                ? {
                    backgroundColor: c.bg,
                    borderColor: c.border,
                    color: c.text,
                    boxShadow: c.glow,
                  }
                : {}
            }
            className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold whitespace-nowrap transition-all duration-200 select-none ${
              active
                ? ''
                : 'border-gray-200 dark:border-violet-500/20 text-gray-400 dark:text-[#4a4870] hover:border-gray-300 dark:hover:border-violet-400/40 hover:text-gray-500 dark:hover:text-violet-300 hover:bg-gray-50/80 dark:hover:bg-violet-500/10'
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  </div>
)}
```

When `lockedCategory` is true, the pills are hidden but `category` state still holds the board slug and gets submitted correctly.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/daniel/QuemadosUm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/PostForm.tsx
git commit -m "feat: PostForm accepts defaultCategory and lockedCategory props"
```

---

### Task 3: Individual board page

**Files:**
- Create: `app/[board]/page.tsx`

**Interfaces:**
- Consumes: `BOARDS`, `isValidBoard`, `getBoard` from `lib/boards.ts`; `PostForm`; `PostCard`; `CategoryFilter` (not used); `useFeedEvents`; `apiGet`; `Post`, `PostCategory` from types; `useAnonId`; `useToast`

- [ ] **Step 1: Create `app/[board]/page.tsx`**

```typescript
'use client';
import { useState, useCallback, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { PostForm } from '@/components/PostForm';
import { PostCard } from '@/components/PostCard';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { apiGet } from '@/lib/apiClient';
import { useAnonId } from '@/hooks/useAnonId';
import { isValidBoard, getBoard } from '@/lib/boards';
import { Post, PostCategory } from '@/types';

export default function BoardPage({ params }: { params: { board: string } }) {
  const { board } = params;

  if (!isValidBoard(board)) notFound();

  const boardMeta = getBoard(board)!;

  const [posts, setPosts]           = useState<Post[]>([]);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(true);
  const { message, showToast }      = useToast();
  const { anonId: username }        = useAnonId();

  const fetchPosts = useCallback(
    async (pg: number, replace: boolean) => {
      setLoading(true);
      const params = new URLSearchParams({ sort: 'recent', page: String(pg), category: board });
      const result = await apiGet<{ posts: Post[] }>(`/api/posts?${params}`);
      if (result.ok) {
        const fetched = result.data.posts ?? [];
        setPosts((prev) => (replace ? fetched : [...prev, ...fetched]));
        setHasMore(fetched.length === 10);
      } else {
        showToast(result.error);
        if (replace) setPosts([]);
      }
      setLoading(false);
    },
    [board, showToast]
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(1, true);
  }, [fetchPosts]);

  function handlePostCreated() {
    setPage(1);
    fetchPosts(1, true);
    showToast('Post publicado');
  }

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post eliminado');
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, false);
  }

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'post:new') {
          if (ev.post.category !== board) return;
          setPosts((prev) => {
            if (prev.some((p) => p.id === ev.post.id)) return prev;
            setNewPostIds((ids) => new Set([...ids, ev.post.id]));
            setTimeout(() => {
              setNewPostIds((ids) => { const n = new Set(ids); n.delete(ev.post.id); return n; });
            }, 600);
            return [ev.post, ...prev];
          });
          return;
        }
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
      },
      [board]
    )
  );

  const isInitialLoad = loading && posts.length === 0;

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
      <div className="flex items-baseline gap-2 mb-1">
        <h1
          className="font-bold text-xl"
          style={{ color: boardMeta.text }}
        >
          /{board}/
        </h1>
        <span className="text-sm text-gray-400 dark:text-[#4a4870]">
          {boardMeta.name} — {boardMeta.description}
        </span>
      </div>

      <PostForm
        onPostCreated={handlePostCreated}
        defaultCategory={board as PostCategory}
        lockedCategory
      />

      <div className="space-y-3">
        {isInitialLoad ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : (
          posts.map((post, index) => {
            const isNew = newPostIds.has(post.id);
            return (
              <PostCard
                key={post.id}
                post={post}
                currentUsername={username}
                onVoted={() => showToast('Voto guardado')}
                onVoteError={(msg) => showToast(msg)}
                onDeleted={handleDeleted}
                onActionError={(msg) => showToast(msg)}
                onReported={() => showToast('Gracias, lo revisaremos.')}
                style={isNew ? undefined : { animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
                className={isNew ? 'animate-new-post-slide' : 'opacity-0 animate-fade-slide-in'}
              />
            );
          })
        )}

        {!loading && posts.length === 0 && (
          <div className="bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/10 rounded-2xl py-14 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
            <p className="text-2xl mb-2">🔥</p>
            <p className="text-gray-500 dark:text-[#6b6a8f] text-sm font-medium">Nada por aquí todavía</p>
            <p className="text-gray-400 dark:text-[#4a4870] text-xs mt-1">Sé el primero en quemar algo</p>
          </div>
        )}
      </div>

      {hasMore && !loading && posts.length > 0 && (
        <button
          onClick={loadMore}
          className="w-full py-3 text-gray-400 hover:text-gray-600 text-sm transition-colors"
        >
          Cargar más
        </button>
      )}

      <Toast message={message} />
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/daniel/QuemadosUm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[board]/page.tsx
git commit -m "feat: add individual board page at /[board]"
```

---

### Task 4: Board index page (replace app/page.tsx)

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `BOARDS`, `getBoard` from `lib/boards.ts`; `PostForm`; `PostCard`; `apiGet`; `Post`; `useToast`

- [ ] **Step 1: Replace `app/page.tsx` with board index**

```typescript
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
                    /{board.slug}/
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/daniel/QuemadosUm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: replace home page with board index showing thread previews"
```

---

### Task 5: Navbar — add board quick-links

**Files:**
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Add board links to Navbar**

Replace `components/Navbar.tsx` with:

```typescript
'use client';
import Link from 'next/link';
import { Search, Sun, Moon, Archive } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { BOARDS } from '@/lib/boards';

export function Navbar() {
  const { theme, toggle } = useTheme();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#06050f]/90 backdrop-blur-md border-b border-black/[0.04] dark:border-violet-500/10 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_0_rgba(124,58,237,0.08)]">
      {/* Main bar */}
      <div className="max-w-[600px] mx-auto px-4 flex items-center justify-between h-12">
        <Link href="/" className="font-bold text-lg">
          <span className="bg-gradient-to-r from-mauve-400 to-mauve-800 dark:from-violet-400 dark:to-violet-700 bg-clip-text text-transparent">
            Deep
          </span>
          <span className="text-gray-900 dark:text-[#e9e5ff]">UM</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/buscar"
            className="text-gray-400 dark:text-[#4a4870] hover:text-gray-700 dark:hover:text-violet-300 transition-colors p-1"
            aria-label="Buscar"
          >
            <Search size={18} strokeWidth={1.5} />
          </Link>

          <Link
            href="/archivo"
            className="text-gray-400 dark:text-[#4a4870] hover:text-gray-700 dark:hover:text-violet-300 transition-colors p-1"
            aria-label="Archivo"
            title="Archivo"
          >
            <Archive size={18} strokeWidth={1.5} />
          </Link>

          <button
            onClick={toggle}
            className="text-gray-400 dark:text-[#4a4870] hover:text-gray-700 dark:hover:text-violet-300 transition-colors p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-violet-500/10"
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark'
              ? <Sun size={16} strokeWidth={1.5} />
              : <Moon size={16} strokeWidth={1.5} />
            }
          </button>
        </div>
      </div>

      {/* Board quick-links bar */}
      <div className="max-w-[600px] mx-auto px-4 h-8 flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {BOARDS.map((board) => (
          <Link
            key={board.slug}
            href={`/${board.slug}`}
            className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded whitespace-nowrap transition-colors text-gray-400 dark:text-[#4a4870] hover:text-gray-700 dark:hover:text-violet-300 hover:bg-gray-100/80 dark:hover:bg-violet-500/10"
          >
            /{board.slug}/
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Update body padding-top in `app/layout.tsx`**

The Navbar is now taller (12 + 8 = 20 = h-20). Update `pt-12` to `pt-20` in the body className:

In `app/layout.tsx`, find:
```
pt-12
```
Replace with:
```
pt-20
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/daniel/QuemadosUm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/Navbar.tsx app/layout.tsx
git commit -m "feat: add board quick-links bar to Navbar"
```
