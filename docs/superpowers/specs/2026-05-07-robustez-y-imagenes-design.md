# Robustez + soporte de imágenes — Design

**Fecha:** 2026-05-07
**Alcance:** endurecer validación/seguridad, mejorar UX bajo fallo, agregar soporte de imágenes en posts y comentarios.

## Contexto

QuemadosUm es un foro estilo "quemones" (Next.js 14 + Postgres + APIs en `app/api/*`). Hoy:
- `lib/sanitize.ts` quita HTML básico pero no normaliza ni limita caracteres de control.
- Solo `POST /api/posts` tiene rate-limit (40/h por IP). Comments, votes, reports están abiertos.
- Frontend usa `if (res.ok)` silencioso: si la red o el server fallan, el usuario no se entera.
- No hay schemas de validación centralizados; los endpoints validan ad-hoc.
- No existe soporte de imágenes en schema, API ni UI.

Restricción del entorno: el proyecto se usa en clase, todos los alumnos comparten la misma IP pública vía Wi-Fi. Cualquier rate-limit basado en IP los bloquearía a todos.

## Objetivos

1. Permitir adjuntar **una imagen opcional** por post y por comentario.
2. Endurecer validación de inputs y rate-limit sin usar IP como key.
3. Cubrir el camino de error para que el usuario siempre sepa qué pasó.

## Sección 1 — Imágenes

### Almacenamiento

- Una imagen opcional por post y por comentario.
- Schema:
  - Nueva columna `image_webp TEXT NULL` en `posts` y `comments`.
  - Migración aditiva en `sql/migrations/2026-05-07-add-images.sql`. Actualizar también `sql/schema.sql`.
- Formato guardado: data URL completa (`data:image/webp;base64,...`) — facilita renderizar directo en `<img src>`.

### Upload y conversión

- Body del POST gana un campo opcional `image: string` (data URL o base64 crudo del archivo original).
- Validación server-side en `lib/imageValidation.ts` (módulo nuevo):
  1. Tamaño decoded ≤ **2 MB**.
  2. Magic bytes en los primeros bytes confirman que es imagen real. Formatos aceptados: JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC.
  3. Si pasa, se convierte con `sharp(buffer).webp({ quality: 80 }).toBuffer()`. **No se redimensiona** — se mantiene la resolución original (decisión explícita del usuario).
  4. El resultado se serializa como `data:image/webp;base64,${buf.toString('base64')}` y se persiste.
- Errores específicos:
  - `400 "Imagen excede 2MB"`
  - `400 "Formato de imagen no soportado"`
  - `400 "Archivo no es una imagen válida"` (magic bytes no coinciden con MIME)

### Dependencia nueva

- `sharp` — estándar de facto para procesamiento de imágenes en Node, binarios pre-compilados, sin compilación nativa en instalación.

### Frontend

- `PostForm` y `CommentForm`:
  - Botón 📎 para adjuntar (`<input type="file" accept="image/*">` oculto).
  - Preview thumbnail con botón ✕ para quitar la imagen.
  - Validación client-side: si `file.size > 2 * 1024 * 1024` → mensaje inline, no se envía.
  - Lectura del `File` con `FileReader.readAsDataURL` → se manda en JSON junto con `content`.
  - Mientras el server procesa, spinner sobre el thumbnail.
- Render:
  - `PostCard`, `CommentList` y la vista de detalle muestran la imagen con `<img>` (data URL no se beneficia de `next/image`).
  - Click en imagen → modal lightbox simple (componente nuevo `ImageLightbox.tsx`).

### Tests

- Unit tests en `__tests__/lib/imageValidation.test.ts`: magic bytes correctos por formato, tamaño excedido, archivo no-imagen.
- Test de integración en `__tests__/api/posts.test.ts` y `__tests__/api/comments.test.ts`: post con imagen ok / imagen muy grande / archivo no-imagen rechazado.

## Sección 2 — Validación y seguridad

### Schemas centralizados

Nuevo módulo `lib/validation.ts` con funciones puras que devuelven un discriminated union:

```ts
type Validated<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
```

Funciones:
- `validatePostInput(body) → Validated<{ content, category, image? }>`
- `validateCommentInput(body) → Validated<{ content, parent_id, image? }>`
- `validateVoteInput(body) → Validated<{ vote_type }>`
- `validateReportInput(body) → Validated<{ reason? }>`

Reglas:
- **Post**: `content` después de sanitize ∈ [1, 500], `category` ∈ enum, `image` opcional ≤ 2MB.
- **Comentario**: `content` ∈ [1, 300], `parent_id` UUID válido o null, `image` opcional ≤ 2MB.
- **Vote**: `vote_type` ∈ {`up`, `down`}.
- **Report**: `reason` opcional, ≤ 200 chars.
- **UUID**: regex (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`) antes de tocar la DB. Evita errores 500 por UUIDs malformados.

Cada handler de API se reduce a:

```ts
const v = validatePostInput(body);
if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
```

### Sanitize endurecido

`lib/sanitize.ts` mantiene el comportamiento text-only, pero además:
- `.normalize('NFKC')` — normaliza Unicode.
- Elimina caracteres de control en el rango U+0000 a U+001F (excepto `\n` y `\t`).
- Colapsa whitespace excesivo (4+ espacios consecutivos → 2).

Es defensa en profundidad: el render de React ya escapa HTML, pero stripping + normalización limita trucos visuales (zalgo, RTL override, homoglifos básicos).

### Rate-limit por sesión/token (no IP)

`lib/rateLimit.ts` se refactoriza a una función genérica:

```ts
checkRateLimit(key: string, opts: { windowMs: number; max: number }): { ok: boolean; retryAfter?: number }
```

Keys por endpoint:
- Posts y comments → `${endpoint}:user:${username}` (sacado de la cookie `session_user`).
  - Posts: 40/h por usuario.
  - Comments: 60/h por usuario.
- Votes y reports → `${endpoint}:token:${voter_token}` (cookie anónima existente en el schema, generada httpOnly si falta).
  - Votes: 200/h por token.
  - Reports: 20/h por token.

Cuando se rebasa: `429` con header `Retry-After: <segundos>`.

Caveat documentado: borrar cookies evade el límite. En contexto de uni no es realista preocuparse por adversarios sofisticados; la alternativa (IP) es estrictamente peor por la red compartida.

### Sesión consistente

- `posts` ya deriva `anon_id` desde la cookie ✅.
- `comments` ya hace lo mismo ✅.
- Auditar `votes` y `reports` para que **nunca** confíen en `username`/`anon_id` del body — solo de la cookie.
- Limpiar `PostForm` que manda `anon_id: username` en el body (el server lo ignora, pero remueve ambigüedad).

### Tests

- `__tests__/lib/validation.test.ts`: casos válidos, longitudes límite, UUIDs malformados, categorías inválidas, vote_type inválido.
- `__tests__/lib/rateLimit.test.ts`: límite alcanzado, ventana se resetea, keys distintas son independientes.
- Test por endpoint que verifica que rate-limit se aplica con la key correcta.

## Sección 3 — UX bajo fallo

### Cliente HTTP centralizado

Nuevo `lib/apiClient.ts`:

```ts
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };
apiGet<T>(url): Promise<ApiResult<T>>
apiPost<T>(url, body): Promise<ApiResult<T>>
```

Comportamiento:
- Hace `fetch`, parsea JSON.
- Captura `TypeError` (red caída) → `{ ok: false, error: "Sin conexión, revisa tu red", status: 0 }`.
- Mapea status conocidos:
  - 400 → mensaje `error` que devolvió el server.
  - 401 → `"Tu sesión expiró"` + flag para abrir `AuthModal`.
  - 429 → `"Estás yendo muy rápido, espera ${retryAfter}s"` (lee header `Retry-After`).
  - 500+ → `"Algo falló del lado del servidor"`.

Todos los componentes que hacen fetch migran a este helper: `PostForm`, `CommentForm`, `VoteButtons`, `app/posts/[id]/page.tsx`, `app/buscar/page.tsx`.

### Toasts en cada flujo

`useToast` y `Toast.tsx` ya existen. Los formularios pasan de `if (res.ok)` silencioso a:
- **Éxito** → toast verde corto ("Publicado", "Comentario enviado").
- **Error** → toast rojo con `result.error`.
- `VoteButtons` solo muestra toast en error (éxito es visual: cambia el contador).

### Estados de carga visibles

- Botones de submit: `aria-busy` + textarea deshabilitado durante submit (evita doble envío).
- Imagen subiéndose: spinner overlay sobre el thumbnail mientras el server procesa.

### Manejo específico por escenario

| Escenario | Comportamiento |
|---|---|
| Imagen rechazada (2MB / formato) | Mensaje inline debajo del thumbnail (no toast — más cercano a la causa). |
| 429 rate-limit | Toast con segundos restantes leídos de `Retry-After`. |
| 401 sesión caducada | Abre `AuthModal` automáticamente. |
| Network error | Toast "Sin conexión", el form **no** se limpia para reintentar. |
| GET de detalle 404 | Página "Este quemón ya no existe" con botón a home. |
| GET de detalle 500/red | Estado de error con botón "Reintentar". |

### Tests

- `__tests__/lib/apiClient.test.ts`: éxito, 400, 429 con Retry-After, network error.
- `__tests__/components/PostForm.test.tsx`: cuando el server responde error, se muestra toast y el contenido **no** se borra.

## Resumen de archivos

**Nuevos:**
- `lib/imageValidation.ts`
- `lib/validation.ts`
- `lib/apiClient.ts`
- `components/ImageLightbox.tsx`
- `sql/migrations/2026-05-07-add-images.sql`
- Tests correspondientes.

**Modificados:**
- `sql/schema.sql` (columnas `image_webp`).
- `lib/sanitize.ts` (NFKC + control chars).
- `lib/rateLimit.ts` (genérico por key).
- `app/api/posts/route.ts` (validation + image).
- `app/api/posts/[id]/comments/route.ts` (validation + image + rate-limit).
- `app/api/posts/[id]/vote/route.ts` (validation + rate-limit por token).
- `app/api/posts/[id]/report/route.ts` (validation + rate-limit por token).
- `components/PostForm.tsx` (image upload + apiClient + toasts).
- `components/CommentForm.tsx` (image upload + apiClient + toasts).
- `components/VoteButtons.tsx` (apiClient + toast en error).
- `components/PostCard.tsx`, `components/CommentList.tsx` (render imagen).
- `app/posts/[id]/page.tsx` (404/error states).
- `package.json` (dependencia `sharp`).

## Fuera de alcance

- Múltiples imágenes por post.
- Edición/eliminación de imágenes después de publicar.
- Moderación automática de contenido de imagen.
- Almacenamiento externo (Cloudinary/S3) — explícitamente se eligió base64 en Postgres.
- Compresión/redimensionamiento client-side — explícitamente se eligió convertir server-side sin redimensionar.
- Migrar el rate-limit a Redis (sigue siendo in-memory, suficiente para uso en clase).
