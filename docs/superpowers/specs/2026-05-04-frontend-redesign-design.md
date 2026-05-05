# QuemadosUM — Frontend Redesign Spec

**Goal:** Elevate the UI from functional/generic to a professional dark social network feel, while renaming categories to match the platform's personality and adding full micro-interaction polish.

**Scope:** Frontend only (components, pages, global styles). One DB migration to rename the category ENUM values.

---

## 1. Design System

### Colors

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0A0A0A` | Page background |
| `--surface` | `#111111` | Card background |
| `--surface-hover` | `#161616` | Card hover state |
| `--border` | `#222222` | Default borders |
| `--border-active` | `#333333` | Hover borders |
| `--primary` | `#F4622A` | Brand accent, "Todo" active filter, submit button |
| `--text-primary` | `#F5F5F5` | Post content, headings |
| `--text-secondary` | `#737373` | anon_id, timestamps |
| `--text-muted` | `#404040` | Placeholder, disabled |

### Category Colors

| Category | DB Value | Hex | Tailwind class |
|---|---|---|---|
| Quemones | `quemones` | `#F4622A` | `orange-500` |
| Infieles | `infieles` | `#E91E8C` | `pink-500` |
| Confesiones | `confesiones` | `#9333EA` | `purple-600` |
| Rumores | `rumores` | `#3B82F6` | `blue-500` |

### Typography

- Body / content: `15px` (up from 14px)
- Meta (anon_id, time, counts): `12px`
- Navbar logo: `font-bold`, "Quemados" in gradient `from-orange-500 to-red-500`, "UM" in white
- All labels: no emojis — text only

---

## 2. Database Migration

The category ENUM changes from 5 values to 4:

**Old:** `chisme | opinion | queja | confesion | pregunta`
**New:** `quemones | infieles | confesiones | rumores`

Migration steps:
1. Add new ENUM values to existing type
2. Update all existing rows to map old → new (best-effort mapping: chisme→quemones, opinion→rumores, queja→quemones, confesion→confesiones, pregunta→rumores)
3. Drop old ENUM values
4. Update `DEFAULT` if any

This is a destructive migration. The mapping is approximate since old content was dev/test data.

**Files affected:** `sql/schema.sql`, `scripts/migrate.ts` (add a separate `scripts/migrate-categories.ts`), `types/index.ts`, all API routes that reference category values, all frontend components.

---

## 3. Navbar

**Component:** New `components/Navbar.tsx` (server component, no interactivity needed)

- `fixed top-0 left-0 right-0 z-50`
- Height: `h-12` (48px)
- Background: `bg-[#0A0A0A]/80 backdrop-blur-md`
- Border: `border-b border-white/5`
- Inner container: `max-w-[600px] mx-auto px-4 flex items-center h-full`
- Logo: `<span className="font-bold text-lg"><span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Quemados</span><span className="text-white">UM</span></span>`
- No subtitle, no right-side elements

**Layout change in `app/layout.tsx`:**
- Add `<Navbar />` before `{children}`
- Body gets `pt-12` to offset the fixed navbar

---

## 4. Components

### 4.1 CategoryPill

Clean text-only pill, no dark opaque background:

```
border border-[category-color]/40  text-[category-color]  bg-[category-color]/10
rounded-full  text-xs  px-2  py-0.5  font-medium
```

Each category uses its own color. "Todo" uses primary orange.

### 4.2 CategoryFilter

- Same pill layout as today
- Active pill: filled with **that category's color** (not generic primary for all)
  - `bg-[category-color] text-white`
- Inactive: `bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600`

### 4.3 PostCard

New layout with category accent bar:

```
<article>
  [3px left accent bar — category color]
  <div padding>
    [header row: avatar-circle + anon_id + CategoryPill | timestamp]
    [content — 15px]
    [footer: VoteButtons | comment-count + report-button]
  </div>
</article>
```

**Avatar circle:** 24px circle, `bg-zinc-800`, shows first 2 chars of anon_id in `text-[10px] text-zinc-400`. Purely decorative.

**Hover state:** `border-zinc-700` (current border is `zinc-800`), background shifts to `#161616`. Use `group` + `group-hover` utilities.

**Content link:** entire content `<p>` is the clickable area to post detail. No underline, subtle hover color shift.

### 4.4 VoteButtons

Pill-shaped outlined buttons:

**Default:**
```
border border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-400
flex items-center gap-1.5
hover:border-orange-500/50 hover:text-orange-400  (upvote)
hover:border-blue-500/50 hover:text-blue-400      (downvote)
```

**After voting up:**
```
bg-orange-500/15 border-orange-500 text-orange-400
```

**After voting down:**
```
bg-blue-500/15 border-blue-500 text-blue-400
```

**Counter animation:** when `counts` changes, apply `animate-vote-bounce` (custom keyframe: scale 1 → 1.25 → 1 over 300ms).

### 4.5 PostForm

**Category selector:** replace `<select>` with 4 pill buttons in a 2×2 grid (or single scrollable row on mobile):

```
[Quemones] [Infieles] [Confesiones] [Rumores]
```

- Inactive: `bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-full text-xs px-3 py-1.5`
- Active: `bg-[category-color]/15 border-[category-color] text-[category-color]`

**Submit button:** "Soltar" (no emoji), `bg-[#F4622A] hover:bg-orange-600`, full rounded-lg.

**Character counter:** same amber warning behavior at <50 chars remaining.

---

## 5. Skeleton Loading

New `components/PostSkeleton.tsx`:

```
<article className="bg-[#111111] border border-[#222222] rounded-xl p-4 animate-pulse">
  [header row: 24px circle + 80px bar + 40px bar]
  [3 lines of content: full, full, 60%]
  [footer: 2 small pill-shaped bars]
</article>
```

In `app/page.tsx`: show `<PostSkeleton />` × 3 while `loading && posts.length === 0` (initial load only). Subsequent loads show existing posts.

---

## 6. Toast System

New `components/Toast.tsx` + `hooks/useToast.ts`:

**Toast component:**
- `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`
- `bg-zinc-800 text-white text-sm px-4 py-2 rounded-full shadow-lg`
- Appears with `animate-toast-in` (slide up + fade in, 200ms)
- Auto-dismisses after 2500ms with fade out

**useToast hook:**
- `showToast(message: string)` — queues a toast
- One toast at a time (new replaces old)

**Usage:**
- Post created → "Post publicado"
- Vote registered → "Voto guardado"
- Post reported → "Post reportado"

---

## 7. Animations

Add to `app/globals.css`:

```css
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes voteBounce {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.25); }
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

Tailwind config — add to `theme.extend.animation`:
```js
'fade-slide-in': 'fadeSlideIn 0.2s ease-out',
'vote-bounce':   'voteBounce 0.3s ease-out',
'toast-in':      'toastIn 0.2s ease-out',
```

**Staggered feed:** posts get `style={{ animationDelay: `${index * 60}ms` }}` + `animate-fade-slide-in` + `opacity-0 [animation-fill-mode:forwards]`.

---

## 8. Files Changed

| File | Action |
|---|---|
| `app/globals.css` | Add keyframes + animation utilities |
| `tailwind.config.ts` | Extend animation + keyframes |
| `app/layout.tsx` | Add `<Navbar />`, `pt-12` on body |
| `app/page.tsx` | Skeletons, toast integration, staggered animation |
| `app/posts/[id]/page.tsx` | Padding for navbar |
| `types/index.ts` | Update `PostCategory` union |
| `components/Navbar.tsx` | **New** |
| `components/CategoryPill.tsx` | New color-per-category logic |
| `components/CategoryFilter.tsx` | Active uses category color |
| `components/PostCard.tsx` | Accent bar, avatar circle, hover |
| `components/VoteButtons.tsx` | Pill style, voted state, bounce animation |
| `components/PostForm.tsx` | Pill category selector |
| `components/PostSkeleton.tsx` | **New** |
| `components/Toast.tsx` | **New** |
| `hooks/useToast.ts` | **New** |
| `scripts/migrate-categories.ts` | **New** — DB ENUM migration |
| `sql/schema.sql` | Update ENUM values |
| `app/api/posts/route.ts` | Update VALID_CATEGORIES |
| `app/api/posts/[id]/comments/route.ts` | No change needed |

---

## 9. Out of Scope

- No changes to API logic beyond category values
- No new pages
- No dark/light mode toggle
- No infinite scroll (keep "Cargar más" button)
- No image uploads
