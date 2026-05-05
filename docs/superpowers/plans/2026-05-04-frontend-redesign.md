# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic dark UI with a professional social-network feel: new category names (quemones/infieles/confesiones/rumores), per-category accent colors, sticky navbar, polished micro-interactions (skeletons, toasts, vote animations, staggered feed).

**Architecture:** Pure frontend changes — no DB migration required for the visual work. Types and API validation are updated to the new category names so the app is consistent (DB migration is a separate task for when Postgres is running). All new components are added in `components/` and `hooks/`; all existing components are rewritten in-place.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, TypeScript, Jest + @testing-library/react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `tailwind.config.ts` | Modify | Add custom keyframes + animation utilities |
| `app/globals.css` | Modify | Add @keyframes CSS definitions |
| `types/index.ts` | Modify | Change PostCategory to 4 new values |
| `app/api/posts/route.ts` | Modify | Update VALID_CATEGORIES |
| `components/Navbar.tsx` | Create | Fixed top navbar with gradient logo |
| `app/layout.tsx` | Modify | Add Navbar, pt-12 on body |
| `components/CategoryPill.tsx` | Modify | Per-category color with new categories |
| `components/CategoryFilter.tsx` | Modify | Per-category active color + new categories |
| `components/PostCard.tsx` | Modify | Accent bar, avatar circle, 15px text, hover |
| `components/VoteButtons.tsx` | Modify | Pill style, color on vote, bounce animation |
| `components/PostForm.tsx` | Modify | 4 pill buttons instead of native select |
| `components/PostSkeleton.tsx` | Create | Pulsing skeleton card |
| `hooks/useToast.ts` | Create | showToast(message) hook |
| `components/Toast.tsx` | Create | Bottom-center auto-dismiss toast |
| `app/page.tsx` | Modify | Skeletons on first load, toast, stagger |
| `app/posts/[id]/page.tsx` | Modify | Add pt-16 to account for fixed navbar |
| `__tests__/components/CategoryPill.test.tsx` | Modify | Update to new 4 categories |
| `__tests__/api/posts.test.ts` | Modify | Update category values in test fixtures |

---

## Task 1: Design tokens — Tailwind config + global CSS

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Extend tailwind.config.ts with custom animations**

Replace the full file content:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        voteBounce: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.25)' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'translateX(-50%) translateY(8px)' },
          to:   { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        },
      },
      animation: {
        'fade-slide-in': 'fadeSlideIn 0.2s ease-out',
        'vote-bounce':   'voteBounce 0.3s ease-out',
        'toast-in':      'toastIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Add @keyframes to globals.css**

Replace the full file content:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

(The keyframes are defined in tailwind.config.ts using Tailwind's `keyframes` extension — no additional CSS needed.)

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: add custom animation tokens (fadeSlideIn, voteBounce, toastIn)"
```

---

## Task 2: Update PostCategory type + API validation

**Files:**
- Modify: `types/index.ts`
- Modify: `app/api/posts/route.ts`
- Modify: `__tests__/api/posts.test.ts`

- [ ] **Step 1: Update the test to use new category names (write failing test first)**

Replace full `__tests__/api/posts.test.ts`:

```ts
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ checkRateLimit: jest.fn().mockReturnValue(true) }));

import { GET, POST } from '@/app/api/posts/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

const mockQuery = query as jest.Mock;
const mockRateLimit = checkRateLimit as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRateLimit.mockReturnValue(true);
});

describe('GET /api/posts', () => {
  it('returns posts array', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'abc', content: 'test' }] });
    const req = new NextRequest('http://localhost/api/posts');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toHaveLength(1);
  });

  it('filters by category when provided', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const req = new NextRequest('http://localhost/api/posts?category=quemones&page=2');
    await GET(req);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('$1');
    expect(params).toContain('quemones');
    expect(params).toContain(10); // offset for page 2
  });
});

describe('POST /api/posts', () => {
  it('returns 400 for empty content', async () => {
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '', category: 'rumores' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid category', async () => {
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'invalid' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for old category values', async () => {
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'chisme' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockReturnValueOnce(false);
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'rumores' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 201 and created post on success', async () => {
    const fakePost = { id: 'uuid', anon_id: 'Anónimo #1234', content: 'hello', category: 'quemones' };
    mockQuery.mockResolvedValue({ rows: [fakePost] });
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'quemones' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.post.id).toBe('uuid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/daniel/QuemadosUm && npx jest __tests__/api/posts.test.ts --no-coverage 2>&1 | tail -20
```

Expected: test "filters by category" fails because `quemones` is not yet a valid category.

- [ ] **Step 3: Update types/index.ts**

```ts
export type PostCategory = 'quemones' | 'infieles' | 'confesiones' | 'rumores';
export type VoteType = 'up' | 'down';

export interface Post {
  id: string;
  anon_id: string;
  content: string;
  category: PostCategory;
  upvotes: number;
  downvotes: number;
  report_count: number;
  is_hidden: boolean;
  created_at: string;
  comment_count?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  anon_id: string;
  content: string;
  created_at: string;
}
```

- [ ] **Step 4: Update VALID_CATEGORIES in app/api/posts/route.ts**

Change only the one line:

```ts
const VALID_CATEGORIES: PostCategory[] = ['quemones', 'infieles', 'confesiones', 'rumores'];
```

- [ ] **Step 5: Run tests**

```bash
cd /home/daniel/QuemadosUm && npx jest __tests__/api/posts.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts app/api/posts/route.ts __tests__/api/posts.test.ts
git commit -m "feat: rename PostCategory to quemones/infieles/confesiones/rumores"
```

---

## Task 3: Navbar component + layout

**Files:**
- Create: `components/Navbar.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create components/Navbar.tsx**

```tsx
export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-[600px] mx-auto px-4 flex items-center h-full">
        <span className="font-bold text-lg">
          <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Quemados
          </span>
          <span className="text-white">UM</span>
        </span>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Update app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QuemadosUM',
  description: 'La voz anónima de la universidad',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 min-h-screen pt-12`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/Navbar.tsx app/layout.tsx
git commit -m "feat: add sticky Navbar with gradient logo"
```

---

## Task 4: CategoryPill — new colors + new categories

**Files:**
- Modify: `components/CategoryPill.tsx`
- Modify: `__tests__/components/CategoryPill.test.tsx`

- [ ] **Step 1: Write the failing tests first**

Replace full `__tests__/components/CategoryPill.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryPill } from '@/components/CategoryPill';

describe('CategoryPill', () => {
  it('renders Quemones label', () => {
    render(<CategoryPill category="quemones" />);
    expect(screen.getByText('Quemones')).toBeInTheDocument();
  });
  it('renders Infieles label', () => {
    render(<CategoryPill category="infieles" />);
    expect(screen.getByText('Infieles')).toBeInTheDocument();
  });
  it('renders Confesiones label', () => {
    render(<CategoryPill category="confesiones" />);
    expect(screen.getByText('Confesiones')).toBeInTheDocument();
  });
  it('renders Rumores label', () => {
    render(<CategoryPill category="rumores" />);
    expect(screen.getByText('Rumores')).toBeInTheDocument();
  });
  it('applies orange color class for quemones', () => {
    const { container } = render(<CategoryPill category="quemones" />);
    expect(container.firstChild).toHaveClass('text-orange-500');
  });
  it('applies pink color class for infieles', () => {
    const { container } = render(<CategoryPill category="infieles" />);
    expect(container.firstChild).toHaveClass('text-pink-500');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/daniel/QuemadosUm && npx jest __tests__/components/CategoryPill.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: fails — "quemones" not in config.

- [ ] **Step 3: Rewrite components/CategoryPill.tsx**

```tsx
import { PostCategory } from '@/types';

const config: Record<PostCategory, { label: string; className: string }> = {
  quemones:    { label: 'Quemones',    className: 'border border-orange-500/40 text-orange-500 bg-orange-500/10' },
  infieles:    { label: 'Infieles',    className: 'border border-pink-500/40 text-pink-500 bg-pink-500/10' },
  confesiones: { label: 'Confesiones', className: 'border border-purple-600/40 text-purple-600 bg-purple-600/10' },
  rumores:     { label: 'Rumores',     className: 'border border-blue-500/40 text-blue-500 bg-blue-500/10' },
};

export function CategoryPill({ category }: { category: PostCategory }) {
  const { label, className } = config[category];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/daniel/QuemadosUm && npx jest __tests__/components/CategoryPill.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/CategoryPill.tsx __tests__/components/CategoryPill.test.tsx
git commit -m "feat: redesign CategoryPill with per-category accent colors"
```

---

## Task 5: CategoryFilter — new categories + per-category active color

**Files:**
- Modify: `components/CategoryFilter.tsx`

- [ ] **Step 1: Rewrite components/CategoryFilter.tsx**

The active state now uses each category's own color. "Todo" uses orange. Static class strings are required so Tailwind doesn't purge them.

```tsx
'use client';
import { PostCategory } from '@/types';

const FILTERS: { value: PostCategory | 'all'; label: string; activeClass: string }[] = [
  { value: 'all',         label: 'Todo',        activeClass: 'bg-orange-500 text-white border-orange-500' },
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-orange-500 text-white border-orange-500' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500 text-white border-pink-500' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600 text-white border-purple-600' },
  { value: 'rumores',     label: 'Rumores',     activeClass: 'bg-blue-500 text-white border-blue-500' },
];

interface CategoryFilterProps {
  active: PostCategory | 'all';
  onChange: (value: PostCategory | 'all') => void;
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-colors ${
            active === f.value
              ? f.activeClass
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite to check nothing broke**

```bash
cd /home/daniel/QuemadosUm && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass (CategoryFilter has no dedicated test, others unchanged).

- [ ] **Step 3: Commit**

```bash
git add components/CategoryFilter.tsx
git commit -m "feat: redesign CategoryFilter with per-category active colors"
```

---

## Task 6: PostCard — accent bar, avatar circle, hover

**Files:**
- Modify: `components/PostCard.tsx`

- [ ] **Step 1: Rewrite components/PostCard.tsx**

New layout: 3px left accent bar by category color, 24px avatar circle, 15px content text, group-hover border/bg shift.

```tsx
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flag, MessageCircle } from 'lucide-react';
import { Post, PostCategory } from '@/types';
import { CategoryPill } from './CategoryPill';
import { VoteButtons } from './VoteButtons';

const accentBar: Record<PostCategory, string> = {
  quemones:    'bg-orange-500',
  infieles:    'bg-pink-500',
  confesiones: 'bg-purple-600',
  rumores:     'bg-blue-500',
};

interface PostCardProps {
  post: Post;
  onReport: (id: string) => void;
  onVoted?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function PostCard({ post, onReport, onVoted, style, className }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  const initials = post.anon_id.slice(0, 2).toUpperCase();

  return (
    <article
      style={style}
      className={`group relative bg-[#111111] border border-[#222222] rounded-xl overflow-hidden hover:border-zinc-700 hover:bg-[#161616] transition-colors ${className ?? ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentBar[post.category]}`} />
      <div className="pl-4 pr-4 pt-3 pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] text-zinc-400 font-medium">{initials}</span>
            </div>
            <span className="text-zinc-500 text-xs">{post.anon_id}</span>
            <CategoryPill category={post.category} />
          </div>
          <span className="text-zinc-600 text-xs">{timeAgo}</span>
        </div>

        <Link href={`/posts/${post.id}`} className="block">
          <p className="text-[#F5F5F5] text-[15px] leading-relaxed break-words hover:text-zinc-300 transition-colors">
            {post.content}
          </p>
        </Link>

        <div className="flex items-center justify-between pt-0.5">
          <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} onVoted={onVoted} />
          <div className="flex items-center gap-3">
            <Link
              href={`/posts/${post.id}`}
              className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
            >
              <MessageCircle size={13} />
              <span>{post.comment_count ?? 0}</span>
            </Link>
            <button
              onClick={() => onReport(post.id)}
              className="text-zinc-700 hover:text-red-400 transition-colors"
              title="Reportar"
              aria-label="Reportar post"
            >
              <Flag size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd /home/daniel/QuemadosUm && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add components/PostCard.tsx
git commit -m "feat: redesign PostCard with accent bar, avatar circle, hover states"
```

---

## Task 7: VoteButtons — pill style + vote state colors + bounce animation

**Files:**
- Modify: `components/VoteButtons.tsx`

- [ ] **Step 1: Rewrite components/VoteButtons.tsx**

Pill-shaped outlined buttons. After voting: fill with category-appropriate color. Counter animates on change. Accepts optional `onVoted` callback for toast.

```tsx
'use client';
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface VoteButtonsProps {
  postId: string;
  upvotes: number;
  downvotes: number;
  onVoted?: () => void;
}

export function VoteButtons({ postId, upvotes, downvotes, onVoted }: VoteButtonsProps) {
  const [counts, setCounts] = useState({ upvotes, downvotes });
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    try {
      const stored: Record<string, 'up' | 'down'> = JSON.parse(
        localStorage.getItem('voted_posts_v2') ?? '{}'
      );
      if (stored[postId]) setVoted(stored[postId]);
    } catch {
      // localStorage unavailable
    }
  }, [postId]);

  async function handleVote(voteType: 'up' | 'down') {
    if (voted) return;
    try {
      const res = await fetch(`/api/posts/${postId}/vote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: voteType }),
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data.votes);
        setVoted(voteType);
        setBounce(true);
        setTimeout(() => setBounce(false), 300);
        const stored: Record<string, 'up' | 'down'> = JSON.parse(
          localStorage.getItem('voted_posts_v2') ?? '{}'
        );
        stored[postId] = voteType;
        localStorage.setItem('voted_posts_v2', JSON.stringify(stored));
        onVoted?.();
      }
    } catch {
      // network error — silently fail
    }
  }

  const upClass = voted === 'up'
    ? 'bg-orange-500/15 border-orange-500 text-orange-400'
    : 'border-zinc-700 text-zinc-400 hover:border-orange-500/50 hover:text-orange-400';

  const downClass = voted === 'down'
    ? 'bg-blue-500/15 border-blue-500 text-blue-400'
    : 'border-zinc-700 text-zinc-400 hover:border-blue-500/50 hover:text-blue-400';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote('up')}
        disabled={!!voted}
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed ${upClass}`}
        aria-label="Upvote"
      >
        <ThumbsUp size={12} />
        <span className={bounce && voted === 'up' ? 'animate-vote-bounce inline-block' : 'inline-block'}>
          {counts.upvotes}
        </span>
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={!!voted}
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed ${downClass}`}
        aria-label="Downvote"
      >
        <ThumbsDown size={12} />
        <span className={bounce && voted === 'down' ? 'animate-vote-bounce inline-block' : 'inline-block'}>
          {counts.downvotes}
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd /home/daniel/QuemadosUm && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add components/VoteButtons.tsx
git commit -m "feat: redesign VoteButtons as pill buttons with vote-state colors and bounce"
```

---

## Task 8: PostForm — pill category selector

**Files:**
- Modify: `components/PostForm.tsx`

- [ ] **Step 1: Rewrite components/PostForm.tsx**

Replace `<select>` with 4 pill buttons. Submit label is "Soltar" (no emoji). Default selected category is `quemones`.

```tsx
'use client';
import { useState } from 'react';
import { PostCategory } from '@/types';

const CATEGORIES: { value: PostCategory; label: string; activeClass: string }[] = [
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-orange-500/15 border-orange-500 text-orange-500' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500/15 border-pink-500 text-pink-500' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600/15 border-purple-600 text-purple-600' },
  { value: 'rumores',     label: 'Rumores',     activeClass: 'bg-blue-500/15 border-blue-500 text-blue-500' },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('quemones');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al publicar');
        return;
      }
      setContent('');
      onPostCreated();
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  const remaining = MAX_CHARS - content.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#111111] border border-[#222222] rounded-xl p-4 space-y-3"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        placeholder="¿Qué está pasando en la U?"
        rows={3}
        className="w-full bg-zinc-900 text-[#F5F5F5] placeholder-[#404040] rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#F4622A]"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${remaining < 50 ? 'text-amber-400' : 'text-zinc-600'}`}>
          {remaining} restantes
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              category === c.value
                ? c.activeClass
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="w-full bg-[#F4622A] hover:bg-orange-600 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
      >
        {loading ? 'Publicando...' : 'Soltar'}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd /home/daniel/QuemadosUm && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add components/PostForm.tsx
git commit -m "feat: replace PostForm category select with pill buttons"
```

---

## Task 9: PostSkeleton component

**Files:**
- Create: `components/PostSkeleton.tsx`

- [ ] **Step 1: Create components/PostSkeleton.tsx**

```tsx
export function PostSkeleton() {
  return (
    <article className="bg-[#111111] border border-[#222222] rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-zinc-800" />
        <div className="h-3 w-20 rounded bg-zinc-800" />
        <div className="h-3 w-10 rounded-full bg-zinc-800" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full rounded bg-zinc-800" />
        <div className="h-3 w-full rounded bg-zinc-800" />
        <div className="h-3 w-3/5 rounded bg-zinc-800" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-14 rounded-full bg-zinc-800" />
        <div className="h-6 w-14 rounded-full bg-zinc-800" />
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/PostSkeleton.tsx
git commit -m "feat: add PostSkeleton loading placeholder"
```

---

## Task 10: Toast system (hook + component)

**Files:**
- Create: `hooks/useToast.ts`
- Create: `components/Toast.tsx`

- [ ] **Step 1: Create hooks/useToast.ts**

```ts
'use client';
import { useState, useCallback } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  return { message, showToast };
}
```

- [ ] **Step 2: Create components/Toast.tsx**

```tsx
interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 text-white text-sm px-4 py-2 rounded-full shadow-lg animate-toast-in">
      {message}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useToast.ts components/Toast.tsx
git commit -m "feat: add Toast component and useToast hook"
```

---

## Task 11: Wire up app/page.tsx + fix posts/[id]/page.tsx

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/posts/[id]/page.tsx`

- [ ] **Step 1: Rewrite app/page.tsx**

Adds: initial-load skeletons (3×), toast on post create + vote, staggered fade-in animation per card.

```tsx
'use client';
import { useState, useCallback, useEffect } from 'react';
import { PostForm } from '@/components/PostForm';
import { PostCard } from '@/components/PostCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PostSkeleton } from '@/components/PostSkeleton';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Post, PostCategory } from '@/types';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState<PostCategory | 'all'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const { message, showToast } = useToast();

  const fetchPosts = useCallback(
    async (cat: PostCategory | 'all', pg: number, replace: boolean) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(pg) });
        if (cat !== 'all') qs.set('category', cat);
        const res = await fetch(`/api/posts?${qs}`);
        const data = await res.json();
        setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]));
        setHasMore(data.posts.length === 10);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(category, 1, true);
  }, [category, fetchPosts]);

  function handleCategoryChange(val: PostCategory | 'all') {
    setCategory(val);
  }

  function handlePostCreated() {
    setPage(1);
    fetchPosts(category, 1, true);
    showToast('Post publicado');
  }

  async function handleReport(postId: string) {
    await fetch(`/api/posts/${postId}/report`, { method: 'POST' });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post reportado');
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPosts(category, next, false);
  }

  const isInitialLoad = loading && posts.length === 0;

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <PostForm onPostCreated={handlePostCreated} />
      <CategoryFilter active={category} onChange={handleCategoryChange} />

      <div className="space-y-3">
        {isInitialLoad ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : (
          posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              onReport={handleReport}
              onVoted={() => showToast('Voto guardado')}
              style={{
                animationDelay: `${index * 60}ms`,
                animationFillMode: 'forwards',
              }}
              className="opacity-0 animate-fade-slide-in"
            />
          ))
        )}
        {!loading && posts.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">
            No hay posts todavía. ¡Sé el primero en quemar!
          </p>
        )}
      </div>

      {hasMore && !loading && posts.length > 0 && (
        <button
          onClick={loadMore}
          className="w-full py-3 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          Cargar más...
        </button>
      )}
      {loading && posts.length > 0 && (
        <p className="text-center text-zinc-600 text-sm py-4">Cargando...</p>
      )}

      <Toast message={message} />
    </main>
  );
}
```

- [ ] **Step 2: Fix app/posts/[id]/page.tsx navbar offset**

The fixed navbar is 48px (h-12). The post detail page needs padding-top adjusted. Change `py-6` to `pt-4 pb-6` (layout already has `pt-12` from the body):

```tsx
  return (
    <main className="max-w-[600px] mx-auto px-4 pt-4 pb-6 space-y-5">
```

- [ ] **Step 3: Run full test suite**

```bash
cd /home/daniel/QuemadosUm && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/posts/[id]/page.tsx components/PostCard.tsx
git commit -m "feat: wire up skeletons, toast notifications, and staggered feed animation"
```

---

## Task 12: DB migration script (run when Postgres is ready)

> **Skip this task until Postgres is set up.** The frontend works without it — the DB just needs the new ENUM values before accepting new posts.

**Files:**
- Create: `scripts/migrate-categories.ts`
- Modify: `sql/schema.sql`

- [ ] **Step 1: Create scripts/migrate-categories.ts**

```ts
import { query } from '@/lib/db';

async function migrateCategories() {
  console.log('Starting category ENUM migration...');

  await query(`ALTER TYPE post_category ADD VALUE IF NOT EXISTS 'quemones'`);
  await query(`ALTER TYPE post_category ADD VALUE IF NOT EXISTS 'infieles'`);
  await query(`ALTER TYPE post_category ADD VALUE IF NOT EXISTS 'confesiones'`);
  await query(`ALTER TYPE post_category ADD VALUE IF NOT EXISTS 'rumores'`);

  await query(`
    UPDATE posts SET category = 'quemones'    WHERE category IN ('chisme', 'queja')
  `);
  await query(`
    UPDATE posts SET category = 'rumores'     WHERE category IN ('opinion', 'pregunta')
  `);
  await query(`
    UPDATE posts SET category = 'confesiones' WHERE category = 'confesion'
  `);

  console.log('Migration complete. Old ENUM values must be dropped manually after verifying data.');
  console.log('Run: ALTER TYPE post_category RENAME TO post_category_old; then recreate with 4 values.');
}

migrateCategories().catch(console.error).finally(() => process.exit());
```

- [ ] **Step 2: Update sql/schema.sql ENUM**

Change the `post_category` ENUM definition to:

```sql
CREATE TYPE post_category AS ENUM ('quemones', 'infieles', 'confesiones', 'rumores');
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-categories.ts sql/schema.sql
git commit -m "feat: add category migration script and update schema ENUM"
```
