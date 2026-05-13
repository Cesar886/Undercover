# Guardar Publicaciones — Design Spec

## Goal

Allow authenticated users to save posts to a personal list accessible at `/guardados`. A bookmark icon on the post detail page toggles the saved state.

## Architecture

Saved posts are stored in PostgreSQL, consistent with how votes and reports are handled in the codebase. The save toggle is a single endpoint that inserts or deletes a row. The `/guardados` page fetches the user's saved posts and renders them with the existing `PostCard` component.

## Database

New table `saved_posts`:

```sql
CREATE TABLE IF NOT EXISTS saved_posts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username   TEXT        NOT NULL,
  post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (username, post_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_username
  ON saved_posts(username, created_at DESC);
```

The `ON DELETE CASCADE` ensures saved rows are cleaned up if the post is deleted.

## API Routes

### `GET /api/posts/[id]/save`

Returns whether the authenticated user has saved the post.

- Auth: required (session). Returns 401 if no session.
- Response: `{ saved: boolean }`

### `POST /api/posts/[id]/save`

Toggles the saved state for the authenticated user.

- Auth: required. Returns 401 if no session.
- If not saved → INSERT → returns `{ saved: true }`
- If already saved → DELETE → returns `{ saved: false }`
- Response: `{ saved: boolean }`

### `GET /api/posts/saved`

Returns all posts saved by the authenticated user, ordered by most recently saved.

- Auth: required. Returns 401 if no session.
- SQL: `SELECT p.* FROM posts p JOIN saved_posts s ON s.post_id = p.id WHERE s.username = $1 AND p.is_hidden = false ORDER BY s.created_at DESC`
- Response: `{ posts: Post[] }`

## UI: Post Detail Page (`app/posts/[id]/page.tsx`)

- After loading the post, fetch `GET /api/posts/[id]/save` to get initial saved state.
- Add a `saved` state variable (`useState<boolean>(false)`) and `savingBookmark` loading state.
- Add a `Bookmark` icon button in the right-side actions row (alongside WhatsApp and report):
  - `fill="currentColor"` when saved, unfilled when not saved.
  - Styled like the other action buttons: `text-stone-400 hover:text-mauve-600 transition-colors`.
  - While toggling: disabled, slight opacity.
  - On click: optimistic toggle → `POST /api/posts/[id]/save` → on error revert + `showToast`.
- `Bookmark` icon imported from `lucide-react` (already in the codebase).

## UI: `/guardados` Page (`app/guardados/page.tsx`)

- Convert to a `'use client'` component.
- On mount, fetch `/api/posts/saved`.
- States: loading (show `PostSkeleton` × 3), empty (show "Nada guardado aún" message with link to feed), loaded (render `PostCard` list).
- Passes `currentUsername` from `/api/auth/me` (same pattern as the main feed).
- No pagination for now — show all saved posts.

## Error Handling

- Network errors on the detail page: `showToast('No se pudo guardar')` and revert optimistic state.
- If the post is not found when fetching save state (404): silently ignore, default `saved = false`.
- `/guardados` fetch error: show inline error message with retry button.

## Out of Scope

- Saving from the feed card (PostCard) — save button is only on the detail page.
- Pagination on `/guardados`.
- Notifications for saves.
- Save count visible to post authors.
