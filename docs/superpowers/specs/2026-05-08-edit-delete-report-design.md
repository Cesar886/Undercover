# Editar / Eliminar / Reportar — Design

**Fecha:** 2026-05-08
**Alcance:** acciones de autor (editar, eliminar) y de cualquier usuario (reportar) sobre posts y comentarios.

## Contexto

QuemonesUM (Next.js 14 + Postgres) actualmente:

- Permite crear posts y comentarios anidados con identidad `anon_id` (= `username` cuando hay sesión, `Anónimo #NNNN` si no).
- Reportar un post sólo incrementa `posts.report_count`; al llegar a 10 marca `is_hidden = true`. No hay tabla `reports`, no se guarda razón, no existe reportar comentarios.
- No existe editar ni eliminar — los autores no pueden cambiar lo que publicaron.

## Objetivos

1. Permitir al **autor** editar y eliminar sus propios posts y comentarios.
2. Permitir a **cualquier usuario** reportar un post o comentario eligiendo una razón.
3. Endurecer el backend: la autorización se valida server-side comparando la sesión con el autor; el cliente nunca decide.

## Sección 1 — Modelo de autoría

La autoría se prueba comparando `session.username` (cookie `session_user`) contra `target.anon_id`. Esto implica:

- Posts/comentarios creados con sesión iniciada se pueden editar/eliminar por su autor.
- Posts/comentarios anónimos (`Anónimo #NNNN`) **no se pueden editar ni eliminar nunca** — no hay forma de probar autoría sin sesión persistente. Confirmado por el usuario.
- El frontend muestra el menú de tres puntos sólo cuando `session.username === post.anon_id` (o `comment.anon_id`). Esto es UX, no seguridad: el backend re-valida en cada request.

## Sección 2 — Cambios de schema

Una migración aditiva en `sql/migrations/2026-05-08-edit-delete-report.sql`:

```sql
-- Posts: marca de edición y borrado lógico opcional (no usado para posts hoy, reservado).
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Comments: edición, soft delete, contadores de reporte y auto-hide simétrico a posts.
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_count  INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_hidden     BOOLEAN     NOT NULL DEFAULT false;

-- Reports: tabla de razones para auditoría/moderación.
CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type  TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  target_id    UUID NOT NULL,
  reason       TEXT NOT NULL,
  detail       TEXT,
  reporter_id  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
```

Notas:

- `updated_at` es `NULL` cuando el item no ha sido editado. Si `updated_at IS NOT NULL`, la UI muestra "(editado)".
- `comments.is_deleted` es el soft-delete cuando el comentario tiene respuestas anidadas.
- `reports.reporter_id` guarda `username` si hay sesión, o `anon:<ip>` si no — sirve para anti-duplicado lógico (no UNIQUE, sólo informativo).

## Sección 3 — Endpoints nuevos / modificados

### Editar post: `PATCH /api/posts/[id]`

- Auth: requiere sesión.
- Autor: `posts.anon_id === session.username`. Si no, **403**.
- Body: `{ content: string }`. Sin imagen por ahora (alcance acotado).
- Validación: misma sanitización y límite de 500 caracteres que `validatePostInput` — extraída a `validateEditPostInput`.
- DB: `UPDATE posts SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING *`.
- Emite `feed:post:edited` para que clientes conectados refresquen.

### Eliminar post: `DELETE /api/posts/[id]`

- Auth: requiere sesión.
- Autor: idem. **403** si no es autor.
- DB: `DELETE FROM posts WHERE id=$1` — `comments` cae por `ON DELETE CASCADE`.
- Emite `feed:post:hidden` (reusa el evento existente para que el feed se limpie).

### Editar comentario: `PATCH /api/posts/[postId]/comments/[id]`

- Auth: requiere sesión, autoría = `comments.anon_id === session.username`. **403** si no.
- Body: `{ content: string }`. Sin cambio de imagen.
- DB: `UPDATE comments SET content=$1, updated_at=NOW() WHERE id=$2 AND is_deleted=false RETURNING *`. Si fue soft-deleted antes, **409 "No se puede editar un comentario eliminado"**.
- Emite `feed:comment:edited`.

### Eliminar comentario: `DELETE /api/posts/[postId]/comments/[id]`

- Auth: requiere sesión, autoría idem. **403**.
- Lógica:
  ```sql
  -- Si tiene respuestas → soft delete; si no → hard delete.
  WITH has_replies AS (
    SELECT 1 FROM comments WHERE parent_id = $1 LIMIT 1
  )
  ...
  ```
  En código:
  1. `SELECT EXISTS(SELECT 1 FROM comments WHERE parent_id=$1)` → `hasReplies`.
  2. Si `hasReplies`: `UPDATE comments SET is_deleted=true, content='', image_webp=NULL WHERE id=$1` (vaciar contenido en DB; el texto "[Este comentario ha sido eliminado]" lo renderiza el frontend para no acoplar copy a la DB).
  3. Si no: `DELETE FROM comments WHERE id=$1`.
- Emite `feed:comment:deleted` con `{ id, soft: boolean }`.

### Reportar post: `POST /api/posts/[id]/report` (modificado)

- Body ahora obligatorio: `{ reason: string, detail?: string }`.
- `reason ∈ {'spam','inappropriate','harassment','misinformation','other'}` validado server-side.
- `detail` sólo se acepta cuando `reason === 'other'` (max 200 chars, sanitizado).
- Inserta una fila en `reports` (con `target_type='post'`) y mantiene la lógica vieja de incrementar `posts.report_count` y `is_hidden` al llegar a 10.
- Rate-limit ya existe; se mantiene.

### Reportar comentario: `POST /api/posts/[postId]/comments/[id]/report` (nuevo)

- Mismo body y validación que el de post.
- Inserta `target_type='comment'`, e incrementa `comments.report_count`. Auto-hide a 10 (`is_hidden=true`).
- Rate-limit reusa la clave `reports:<reporterKey>` ya existente.

### Validación centralizada — `lib/validation.ts`

- `validateEditPostInput(body) → Validated<{ content }>`.
- `validateEditCommentInput(body) → Validated<{ content }>`.
- `validateReportInput(body) → Validated<{ reason, detail? }>` — reemplaza el actual (más laxo). Acepta sólo razones del enum; `detail` sólo si `reason === 'other'`.

### Cliente — `lib/apiClient.ts`

- Agregar `apiDelete<T>(url)` y conservar `apiPatch` (ya existe).

## Sección 4 — UI / Componentes

### Menú de tres puntos del autor

Componente nuevo `components/AuthorMenu.tsx`:

- Trigger: ícono `MoreHorizontal` de lucide, sutil (color `stone-300`, hover `stone-600`).
- Solo se monta si `session.username === item.anon_id`.
- Dropdown anclado debajo, con `Edit` (Pencil) y `Delete` (Trash2, texto rojo). Cierre por click-outside (listener en `document`) y `Escape`.
- Accesibilidad: `role="menu"`, items `role="menuitem"`, foco gestionado al abrir/cerrar.

Posición:

- En `PostCard` y en la cabecera del post de detalle: junto a la fecha del header.
- En `CommentItem` (dentro de `LocalComments.tsx`): junto a la fecha, alineado a la derecha del row.
- Visibilidad: el menú de tres puntos sólo se muestra al autor (con Edit + Delete). Los no-autores ven el ícono de bandera (Reportar) como hoy. Son mutuamente excluyentes — uno no se reporta a sí mismo, y nadie ajeno edita/borra.

### Edición inline

Componente `components/InlineEditor.tsx`:

- Reemplaza el `<p>` del contenido por un `<textarea>` autoescalable, prellenado con el texto actual.
- Botones `Guardar` (estilo primario stone-900) y `Cancelar` (texto sutil).
- Mismo contador de caracteres y `CharRing` que ya usan los formularios (300 para comentarios, 500 para posts).
- Al guardar:
  - Optimistic update local + llamada `apiPatch`.
  - Si falla: revertir y mostrar `Toast` con el error.
- `Esc` = cancelar, `Cmd/Ctrl+Enter` = guardar.

### Marca "(editado)"

- En `PostCard`, `app/posts/[id]/page.tsx`, y `CommentItem`: si `updated_at != null`, junto al timestamp poner `· editado` con `title` que muestra la fecha exacta de edición.

### Modal de confirmación de borrado

Componente `components/ConfirmDialog.tsx` (custom, no `window.confirm`):

- Overlay semitransparente, panel centrado, foco trampeado dentro.
- Título: "¿Eliminar post?" / "¿Eliminar comentario?".
- Texto secundario: para comentarios con respuestas, advierte que el texto será reemplazado por "[Este comentario ha sido eliminado]" pero las respuestas se conservan.
- Botones `Cancelar` (sutil) y `Eliminar` (rojo, primario). `Esc` cancela.

### Modal de reporte

Componente `components/ReportDialog.tsx`:

- Lista de razones como radio cards: Spam, Contenido inapropiado, Acoso, Información falsa, Otro.
- Si selecciona `Otro`, aparece textarea opcional (200 chars) "Cuéntanos brevemente".
- Botones `Cancelar` y `Enviar reporte`.
- Tras éxito: cierra modal y `Toast: "Gracias, lo revisaremos."`.

### Render de comentario soft-deleted

En `CommentItem`:

- Si `comment.is_deleted`: render del texto en cursiva gris claro `[Este comentario ha sido eliminado]`, sin avatar del autor (placeholder neutro), sin botón de responder ni menú. Las respuestas anidadas se siguen mostrando normales.

## Sección 5 — Tipos

`types/index.ts`:

```ts
export interface Post {
  // ...campos existentes
  updated_at: string | null;
}

export interface Comment {
  // ...campos existentes
  updated_at: string | null;
  is_deleted: boolean;
  report_count: number;
  is_hidden: boolean;
}

export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'misinformation' | 'other';

export interface ReportPayload {
  reason: ReportReason;
  detail?: string;
}
```

## Sección 6 — Eventos del feed

`lib/events.ts` gana tres tipos nuevos:

- `{ type: 'post:edited', post: Post }`
- `{ type: 'comment:edited', postId: string, comment: Comment }`
- `{ type: 'comment:deleted', postId: string, commentId: string, soft: boolean }`

Los consumidores existentes (`PostCard`, `LocalComments`, página de detalle) los manejan para mantener UI sincronizada en tiempo real.

## Sección 7 — Tests

Unit (`__tests__/lib/`):

- `validation.test.ts`: nuevos casos para `validateEditPostInput`, `validateEditCommentInput`, `validateReportInput` (razón inválida, detalle sin `other`, detalle excesivo).

Integración (`__tests__/api/`):

- `posts.edit-delete.test.ts`: PATCH/DELETE como autor (200), como otro usuario (403), sin sesión (401), post inexistente (404).
- `comments.edit-delete.test.ts`: idem; además soft delete cuando hay replies, hard delete cuando no.
- `reports.test.ts`: razón válida persiste fila en `reports`, razón inválida 400, comment report incrementa `comments.report_count` y oculta en 10.

## Sección 8 — Lo que NO hace este spec

- Edición de imágenes en posts/comentarios (sólo texto se edita; la imagen original se conserva o se quita explícitamente en una iteración futura).
- Vista de moderador / dashboard de reportes (los reports se guardan, alguien los consultará por SQL directo en esta etapa).
- Historial de ediciones (sólo se guarda el último contenido + `updated_at`).
- Edición/borrado por moderadores ajenos al autor.

## Riesgos y mitigaciones

- **Bypass de autoría vía API directa:** mitigado: el cliente nunca envía `userId`; el server lee `session_user` de cookie httpOnly y compara contra `anon_id` de la fila.
- **Race condition al borrar comentario sin respuestas mientras alguien está respondiendo:** acepto el riesgo. Si la respuesta se inserta en el instante después del check pero antes del DELETE, FK `parent_id` quedará dangling. Mitigación: hacer el check y el delete en una transacción con `SELECT ... FOR UPDATE` sobre el comentario y `EXISTS` dentro. Lo aplicaré.
- **Sanitización del contenido editado:** mismo `sanitize()` que la creación. Verificado.
- **Reportes spam:** ya existe rate-limit de reports; sin cambios.
