# Share Post as Image — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button to share any post as a PNG image using html2canvas, with Web Share API on mobile and auto-download fallback on desktop.

**Architecture:** A reusable `ShareImageButton` component receives a `ref` to the post's `<article>` element and calls `html2canvas` to capture it at 2× resolution. It then shares via the Web Share API (mobile) or triggers a download (desktop). The button is placed alongside the existing WhatsApp share button in both `PostCard` and the post detail page.

**Tech Stack:** html2canvas, Web Share API, lucide-react (`ImageDown`, `Loader2`), React `useRef`

---

### Task 1: Install html2canvas

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /home/daniel/QuemadosUm && npm install html2canvas
```

Expected output: `added 1 package` (no errors).

- [ ] **Step 2: Verify it resolves**

```bash
node -e "require('html2canvas'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install html2canvas for share-as-image feature"
```

---

### Task 2: Create `ShareImageButton` component

**Files:**
- Create: `components/ShareImageButton.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import { useRef, useState } from 'react';
import { ImageDown, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface ShareImageButtonProps {
  targetRef: React.RefObject<HTMLElement | null>;
  postId: string;
  className?: string;
}

export function ShareImageButton({ targetRef, postId, className }: ShareImageButtonProps) {
  const [generating, setGenerating] = useState(false);

  async function handleShare() {
    if (!targetRef.current || generating) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(targetRef.current as HTMLElement, {
        useCORS: true,
        scale: 2,
        backgroundColor: null,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas empty'))), 'image/png');
      });

      const file = new File([blob], `quemados-${postId}.png`, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Post de QuemadosUM' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quemados-${postId}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={generating}
      className={`text-stone-300 dark:text-zinc-600 hover:text-stone-500 dark:hover:text-zinc-400 transition-colors disabled:opacity-50 ${className ?? ''}`}
      title="Compartir como imagen"
      aria-label="Compartir post como imagen"
    >
      {generating
        ? <Loader2 size={13} className="animate-spin" />
        : <ImageDown size={13} strokeWidth={1.5} />}
    </button>
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
git add components/ShareImageButton.tsx
git commit -m "feat: add ShareImageButton component using html2canvas"
```

---

### Task 3: Add share button to `PostCard`

**Files:**
- Modify: `components/PostCard.tsx`

The `article` element currently has no ref. We need to add one and pass it to `ShareImageButton`.

- [ ] **Step 1: Add `useRef` import and ref declaration**

In `PostCard.tsx`, add `useRef` to the React import and declare the ref near the top of the component body (after existing `useState` declarations):

```tsx
// Change the React import line from:
import { useState, useCallback } from 'react';
// to:
import { useState, useCallback, useRef } from 'react';
```

Then after the existing `useState` declarations (around line 58), add:

```tsx
const articleRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Attach ref to the `<article>` element**

The `<article>` opening tag (line ~122) currently reads:
```tsx
<article
  style={style}
  className={`group relative bg-white ...`}
>
```

Add `ref={articleRef}`:
```tsx
<article
  ref={articleRef}
  style={style}
  className={`group relative bg-white dark:bg-[#0c0c0c] border border-black/[0.04] dark:border-white/5 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-black/[0.08] dark:hover:border-white/10 dark:hover:bg-[#111111] transition-all duration-300 cursor-pointer ${className ?? ''}`}
>
```

- [ ] **Step 3: Import `ShareImageButton`**

Add to the imports section:
```tsx
import { ShareImageButton } from './ShareImageButton';
```

- [ ] **Step 4: Add the button to the actions row**

Find the `<div className="relative z-[2] flex items-center justify-between">` block (around line 196). Inside it, locate the right side `<div className="flex items-center gap-3">` and add `<ShareImageButton>` right before the WhatsApp `<a>` tag:

```tsx
<div className="flex items-center gap-3">
  <Link
    href={`/posts/${post.id}`}
    className="flex items-center gap-1.5 text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-zinc-300 text-xs transition-colors"
  >
    <MessageCircle size={13} strokeWidth={1.5} />
    <span>{commentCount}</span>
  </Link>
  <ShareImageButton targetRef={articleRef} postId={post.id} />
  <a
    href={`https://wa.me/?text=${encodeURIComponent(`¡Mira esto en la UM! 🔥 ${process.env.NEXT_PUBLIC_BASE_URL}/posts/${post.id}`)}`}
    target="_blank"
    rel="noopener noreferrer"
    title="Compartir en WhatsApp"
    aria-label="Compartir en WhatsApp"
    className="text-stone-300 dark:text-zinc-600 hover:text-[#25D366] transition-colors"
  >
    ...WhatsApp SVG...
  </a>
  ...
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/daniel/QuemadosUm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/PostCard.tsx
git commit -m "feat: add share-as-image button to PostCard"
```

---

### Task 4: Add share button to the post detail page

**Files:**
- Modify: `app/posts/[id]/page.tsx`

- [ ] **Step 1: Add `useRef` import**

In `app/posts/[id]/page.tsx`, `useRef` is not yet imported. Change:
```tsx
import { useState, useEffect, useCallback } from 'react';
```
to:
```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
```

- [ ] **Step 2: Import `ShareImageButton`**

Add to imports:
```tsx
import { ShareImageButton } from '@/components/ShareImageButton';
```

- [ ] **Step 3: Declare the ref**

Inside `PostPage()`, after the existing `useState` declarations, add:
```tsx
const articleRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 4: Attach ref to the `<article>` element**

The `<article>` at line ~185 currently reads:
```tsx
<article className={`relative bg-white dark:bg-[#0c0c0c] border border-black/[0.04] dark:border-white/5 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none`}>
```

Add `ref={articleRef}`:
```tsx
<article ref={articleRef} className={`relative bg-white dark:bg-[#0c0c0c] border border-black/[0.04] dark:border-white/5 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none`}>
```

- [ ] **Step 5: Add the button to the actions row**

Find the right-side actions `<div className="flex items-center gap-4 text-gray-400 dark:text-zinc-500">` (around line 258). Add `<ShareImageButton>` before the WhatsApp `<a>`:

```tsx
<div className="flex items-center gap-4 text-gray-400 dark:text-zinc-500">
  <span className="flex items-center gap-1 text-xs">
    <MessageCircle size={13} />
    <span>{commentCount}</span>
  </span>
  <ShareImageButton targetRef={articleRef} postId={post.id} />
  <a
    href={`https://wa.me/?text=...`}
    ...
  >
    ...WhatsApp...
  </a>
  ...
</div>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /home/daniel/QuemadosUm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/posts/[id]/page.tsx
git commit -m "feat: add share-as-image button to post detail page"
```
