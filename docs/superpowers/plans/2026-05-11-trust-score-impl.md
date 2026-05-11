# Plan: Trust Score System — Implementación
**Fecha:** 2026-05-11  
**Spec:** `docs/superpowers/specs/2026-05-11-trust-score-design.md`  
**Rama:** `feature/trust-score`

---

## Resumen de enfoque

Implementar el sistema de confianza en capas, de abajo hacia arriba:
1. Base de datos (migración SQL)
2. Lógica central (`lib/trust.ts`)
3. Endpoints modificados
4. Endpoint nuevo (comment vote)
5. UI

Cada capa es independiente de la siguiente, lo que permite verificar sin necesidad de tener la UI lista.

---

## Paso 1 — Migración SQL

**Archivo:** `sql/migrations/add_trust_score.sql`

```sql
-- Columnas en users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trust_score      INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_unlocked   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_end   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_count INTEGER     NOT NULL DEFAULT 0;

-- milestone en posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS milestone_5_rewarded BOOLEAN NOT NULL DEFAULT false;

-- votos en comments
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS upvotes   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvotes INTEGER NOT NULL DEFAULT 0;

-- tabla nueva
CREATE TABLE IF NOT EXISTS comment_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID        NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  voter_token TEXT        NOT NULL,
  vote_type   TEXT        NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, voter_token)
);
```

**Verificación:** Ejecutar en la DB. Confirmar que las tablas/columnas existen con `\d users` y `\d comment_votes`.

---

## Paso 2 — `lib/trust.ts`

Archivo nuevo. Exporta:
- `applyTrustDelta(username: string, baseDelta: number, client: PoolClient): Promise<void>`
- `shouldApplyTrustForVote(voterUsername: string | null, authorUsername: string): boolean`

### Lógica de `applyTrustDelta`

```typescript
const row = await client.query(
  'SELECT trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count FROM users WHERE username = $1 FOR UPDATE',
  [username]
);
if (!row.rows[0]) return; // usuario no existe, ignorar

const { trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count } = row.rows[0];

// Ajustar delta
let delta = baseDelta;
if (baseDelta > 0 && trust_score < 10) delta = Math.floor(baseDelta / 2);
if (baseDelta < 0 && trust_score < 0) delta = Math.ceil(baseDelta * 1.5);

const newScore = trust_score + delta;

// Unlock
const shouldUnlock = newScore >= 10 && !trust_unlocked;

// Calcular suspensión
let newIsSuspended = is_suspended;
let newSuspensionEnd = suspension_end;

if (newScore < 0) {
  if (!is_suspended) {
    if (suspension_count >= 1) {
      newIsSuspended = true; newSuspensionEnd = null; // permanente
    } else if (newScore <= -11) {
      newIsSuspended = true; newSuspensionEnd = new Date(Date.now() + 7*24*60*60*1000);
    } else {
      newIsSuspended = true; newSuspensionEnd = new Date(Date.now() + 24*60*60*1000);
    }
  } else if (suspension_end !== null) {
    // ya suspendido, posible escalado
    if (suspension_count >= 1) {
      newSuspensionEnd = null; // promover a permanente
    } else if (newScore <= -11) {
      const sevenDays = new Date(Date.now() + 7*24*60*60*1000);
      if (!suspension_end || suspension_end < sevenDays) newSuspensionEnd = sevenDays;
    }
  }
}

await client.query(
  `UPDATE users SET
     trust_score    = $1,
     trust_unlocked = CASE WHEN $2 THEN true ELSE trust_unlocked END,
     is_suspended   = $3,
     suspension_end = $4
   WHERE username = $5`,
  [newScore, shouldUnlock, newIsSuspended, newSuspensionEnd, username]
);
```

### Lógica de `shouldApplyTrustForVote`

```typescript
function shouldApplyTrustForVote(voterUsername: string | null, authorUsername: string): boolean {
  if (!voterUsername) return true; // anónimo, sí aplica
  return voterUsername !== authorUsername;
}
```

**Verificación:** Unit test con casos borde: score en 9 con delta +2 (resultado +1, unlock), score en -1 con delta -2 (resultado -3), auto-voto ignorado.

---

## Paso 3 — `GET /api/auth/me`

**Archivo:** `app/api/auth/me/route.ts`

Cambios:
1. Leer `username` de la cookie `session_user`.
2. Si hay username → `SELECT trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count FROM users WHERE username = $1`.
3. Hacer reset de suspensión expirada:
   - Si `is_suspended && suspension_end && suspension_end < now()`:
     - `trust_score = 0`, `is_suspended = false`, `trust_unlocked = false`
     - Si la suspensión fue de 7 días (diferencia original ≥ 6 días) → `suspension_count += 1`
     - UPDATE en la DB
4. Incluir `trust_score`, `trust_unlocked`, `is_suspended`, `suspension_end` en la respuesta junto al user.

**Nota:** Para saber si la suspensión era de 7 días, comparar `suspension_end - created_at` no es trivial sin guardar la fecha de inicio. Alternativa simple: si `suspension_end - NOW() > 6 days` al momento de crearse. Como no guardamos eso, usar heurística: si `suspension_count === 0` (todavía no ha cumplido ninguna de 7 días), no incrementar. Si viene de una suspensión con `suspension_end` (no permanente) y era de tipo 7 días se incrementa. 

Solución pragmática: agregar columna `suspension_type TEXT CHECK (IN ('24h', '7d'))` al hacer la migración, o simplemente: al resetear, siempre incrementar `suspension_count` cuando la suspensión no era permanente (`suspension_end IS NOT NULL`). Esto simplifica el código y la lógica de "una suspensión de 7 días cumplida" es equivalente a "al menos una suspensión cumplida" dado que solo se puede llegar a 7 días una vez antes del ban permanente.

**Verificación:** Llamar a `GET /api/auth/me` con un usuario con trust data y confirmar que los campos aparecen en la respuesta.

---

## Paso 4 — `PATCH /api/posts/[id]/vote`

**Archivo:** `app/api/posts/[id]/vote/route.ts`

Cambios en el `withTransaction`:
1. Importar `applyTrustDelta`, `shouldApplyTrustForVote` desde `@/lib/trust`.
2. Extraer `voterUsername` del session cookie (puede ser null si es anónimo).
3. Extraer `anon_id` del post (que en esta app es el username real del autor): `SELECT anon_id FROM posts WHERE id = $1`.
4. Si `shouldApplyTrustForVote(voterUsername, authorUsername)`:
   - Voto up → `applyTrustDelta(authorUsername, +2, client)`
   - Voto down → `applyTrustDelta(authorUsername, -2, client)`
5. Después de actualizar contadores, verificar milestone 5 upvotes netos:
   ```sql
   SELECT upvotes, downvotes, milestone_5_rewarded FROM posts WHERE id = $1
   ```
   Si `upvotes - downvotes >= 5` y `!milestone_5_rewarded`:
   - `UPDATE posts SET milestone_5_rewarded = true WHERE id = $1`
   - `applyTrustDelta(authorUsername, +10, client)`

**Nota:** Todo esto dentro del mismo `withTransaction`, usando el mismo `client`.

**Verificación:** Votar en un post como otro usuario y verificar que `trust_score` del autor cambia en la DB.

---

## Paso 5 — `POST /api/posts/[id]/report` — trust al ocultar

**Archivo:** `app/api/posts/[id]/report/route.ts`

Cambios:
1. Cambiar de `query()` a `withTransaction()` (actualmente usa `query` directo).
2. Importar `applyTrustDelta` desde `@/lib/trust` y `withTransaction` desde `@/lib/db`.
3. Dentro de la transacción, después de actualizar `report_count`:
   - Si `result.rows[0].is_hidden === true` (el post acaba de ocultarse con este reporte):
     a. `SELECT anon_id FROM posts WHERE id = $1` → obtener autor del post
     b. `applyTrustDelta(postAuthor, -15, client)`
     c. `SELECT DISTINCT reporter_id FROM reports WHERE target_id = $1 AND target_type = 'post'`
     d. Para cada `reporter_id` que empiece con `user:` → extraer username → `applyTrustDelta(username, +3, client)`
4. Mantener la lógica del INSERT a `reports` y el emit del evento.

**Verificación:** Crear un post, reportarlo 10 veces (desde distintos reporters), confirmar que al ocultarse el autor recibe -15 y los reportantes con `user:` reciben +3.

---

## Paso 6 — Bloqueo por suspensión en creación

### `POST /api/posts/route.ts`

Después de parsear la sesión, antes de cualquier otra lógica:
```typescript
const { rows } = await query(
  'SELECT is_suspended, suspension_end FROM users WHERE username = $1',
  [username]
);
const user = rows[0];
if (user?.is_suspended) {
  const isPermanent = user.suspension_end === null;
  const isActive = isPermanent || new Date(user.suspension_end) > new Date();
  if (isActive) {
    const msg = isPermanent
      ? 'Tu cuenta ha sido suspendida permanentemente por reincidencia.'
      : `Tu cuenta está suspendida hasta ${formatSuspensionDate(user.suspension_end)}. Revisa nuestras reglas para evitar futuras suspensiones.`;
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
```

La función `formatSuspensionDate` vive en `lib/trust.ts`:
```typescript
export function formatSuspensionDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
```

### `POST /api/posts/[id]/comments/route.ts`

Mismo chequeo después de obtener el `anonId` (username) del usuario.

**Verificación:** Suspender manualmente un usuario en la DB, intentar crear un post/comentario, recibir 403 con mensaje correcto.

---

## Paso 7 — Nuevo endpoint: `POST /api/posts/[id]/comments/[commentId]/vote`

**Archivo nuevo:** `app/api/posts/[id]/comments/[commentId]/vote/route.ts`

Estructura idéntica a `PATCH /api/posts/[id]/vote` pero:
- Tabla: `comment_votes` en lugar de `votes`
- Objeto: `comments` en lugar de `posts`
- Columnas de conteo: en `comments`
- Sin milestone de 5 upvotes netos (no aplica a comentarios)
- Usar el mismo `hashVoterToken` con el `commentId` como segundo argumento

Pasos internos del PATCH:
1. Validar `commentId` con `isUuid`.
2. Rate limit: reusar `RATE_LIMITS.votes` con key `votes:${voterKey}`.
3. Verificar si ya votó en `comment_votes`.
4. `withTransaction`:
   - INSERT en `comment_votes`
   - UPDATE `comments SET upvotes/downvotes += 1`
   - `SELECT anon_id FROM comments WHERE id = $1` → autor del comentario
   - Si `shouldApplyTrustForVote(voterUsername, commentAuthor)` → `applyTrustDelta`
5. Retornar `{ votes: { upvotes, downvotes } }`.

**Verificación:** Votar en un comentario, confirmar que los contadores cambian y el trust del autor se actualiza.

---

## Paso 8 — Actualización de tipos TypeScript

**Archivo:** `types/index.ts`

Agregar en el tipo `User`:
```typescript
trust_score: number;
trust_unlocked: boolean;
is_suspended: boolean;
suspension_end: string | null;
```

Agregar en el tipo `Comment`:
```typescript
upvotes: number;
downvotes: number;
```

**Verificación:** `npx tsc --noEmit` sin errores.

---

## Paso 9 — UI: Badge de confianza

### `components/PostCard.tsx`

- Recibir `trust_score` y `trust_unlocked` del autor (del objeto post, no del usuario en sesión).
- **Problema:** actualmente el post no trae estos datos. Alternativa: mostrar el trust del usuario en sesión cuando es su propio post, o no mostrarlo en PostCard.
- **Decisión de diseño:** No mostrar el trust del *autor* en PostCard (requeriría JOIN con users en la query de posts). Solo mostrar en la página de detalle del post (`posts/[id]/page.tsx`).

### `app/posts/[id]/page.tsx`

- Si el post fue creado por el usuario en sesión: mostrar badge con `trust_unlocked ? trust_score : '?'`.
- Tooltip de Mantine con texto: `"La confianza sube con votos positivos y baja con reportes o votos negativos."`

### `components/LocalComments.tsx`

- Para comentarios del usuario en sesión: mostrar badge de confianza igual.
- Al intentar comentar estando suspendido → mostrar el mensaje de error del 403.

### Mensaje de suspensión en UI

Cuando el POST retorna 403 con `error` de suspensión, mostrar ese mensaje en el Toast o inline.

**Verificación:** Iniciar sesión, verificar que el badge aparece correctamente en la página de detalle.

---

## Orden de implementación recomendado

```
Paso 1 → Paso 2 → Paso 3 → Paso 4 → Paso 5 → Paso 6 → Paso 7 → Paso 8 → Paso 9
  SQL     trust.ts  /me    vote    report  bloqueo  comvote  types   UI
```

Los pasos 4, 5 y 6 son independientes entre sí y pueden ejecutarse en cualquier orden después del Paso 2.
El Paso 7 es independiente de los pasos 4–6.
El Paso 8 puede hacerse en paralelo con cualquier paso.
El Paso 9 solo puede hacerse después del Paso 3 (para tener los datos de trust en sesión).

---

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `sql/migrations/add_trust_score.sql` | Crear |
| `lib/trust.ts` | Crear |
| `app/api/auth/me/route.ts` | Modificar |
| `app/api/posts/[id]/vote/route.ts` | Modificar |
| `app/api/posts/[id]/report/route.ts` | Modificar |
| `app/api/posts/route.ts` | Modificar (bloqueo suspensión) |
| `app/api/posts/[id]/comments/route.ts` | Modificar (bloqueo suspensión) |
| `app/api/posts/[id]/comments/[commentId]/vote/route.ts` | Crear |
| `types/index.ts` | Modificar |
| `app/posts/[id]/page.tsx` | Modificar (badge trust) |
| `components/LocalComments.tsx` | Modificar (badge + mensaje suspensión) |

---

## Casos borde cubiertos por el plan

- Auto-voto: `shouldApplyTrustForVote` retorna false → no delta
- Milestone 5 upvotes netos: flag `milestone_5_rewarded` evita doble reward
- Reportantes anónimos (`anon:IP`): filtrados al recompensar con +3
- Escalado de suspensión ya activa: manejado en `applyTrustDelta`
- Suspensión expirada: reseteada en `GET /api/auth/me`
- Usuario inexistente en trust: `applyTrustDelta` sale silenciosamente con `return`
