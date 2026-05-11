# Trust Score System — Spec

**Fecha:** 2026-05-11  
**Proyecto:** QuemadosUm  
**Stack:** Next.js 14, PostgreSQL (raw `pg`), no ORM

---

## Objetivo

Implementar un sistema de confianza numérico por usuario que incentiva contribuciones positivas, penaliza comportamiento tóxico, y resiste manipulación de usuarios nuevos/trolls. Solo aplica a usuarios registrados.

---

## 1. Cambios en base de datos

### 1a. Nuevas columnas en `users`

```sql
ALTER TABLE users
  ADD COLUMN trust_score      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN trust_unlocked   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_suspended     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN suspension_end   TIMESTAMPTZ,
  ADD COLUMN suspension_count INTEGER NOT NULL DEFAULT 0;
```

- `trust_unlocked`: se activa una sola vez cuando el score llega a 10 por primera vez. Una vez `true`, nunca vuelve a `false`.
- `is_suspended` + `suspension_end`: `NULL` en `suspension_end` con `is_suspended = true` = ban permanente.
- `suspension_count`: cuenta cuántas suspensiones de 7 días ha cumplido. Al llegar a 1 suspensión de 7 días cumplida y volver a negativo → ban permanente.

### 1b. Nueva tabla `comment_votes`

```sql
CREATE TABLE comment_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  voter_token TEXT NOT NULL,
  vote_type   TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, voter_token)
);
```

### 1c. Nuevas columnas en `comments`

```sql
ALTER TABLE comments
  ADD COLUMN upvotes   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN downvotes INTEGER NOT NULL DEFAULT 0;
```

---

## 2. Reglas de cálculo de confianza

### 2a. Tabla de deltas

| Acción | Delta base | Fase lenta (score < 10) |
|---|---|---|
| 👍 Voto positivo (post o comentario) | +2 | +1 |
| 👎 Voto negativo (post o comentario) | -2 | -3 si score < 0 |
| Post auto-ocultado por reportes | -15 | -20 si score < 0 |
| Reporte exitoso (post ocultado) | +3 | +1 |
| Post alcanza 5 upvotes netos por primera vez (upvotes - downvotes pasa de 4 a ≥ 5) | +10 (una sola vez por post) | +5 |

### 2b. Reglas ocultas (no mostrar en UI)

1. **Fase lenta:** Si `trust_score < 10`, las ganancias se reducen a la mitad (redondeado hacia abajo). Esto aplica al usuario que **recibe** los puntos.
2. **Penalización aumentada:** Si `trust_score < 0`, las penalizaciones aumentan ×1.5 (redondeado hacia arriba).
3. **Estas dos reglas nunca se comunican al usuario.**

### 2c. Función central: `applyTrustDelta`

Archivo: `lib/trust.ts`

```typescript
async function applyTrustDelta(
  username: string,
  baseDelta: number,
  client: PoolClient
): Promise<void>
```

Lógica interna:
1. Obtener `trust_score` actual del usuario con `SELECT FOR UPDATE`.
2. Calcular delta ajustado:
   - Si `baseDelta > 0` y `trust_score < 10` → `delta = Math.floor(baseDelta / 2)`
   - Si `baseDelta < 0` y `trust_score < 0` → `delta = Math.ceil(baseDelta * 1.5)`
   - En cualquier otro caso → `delta = baseDelta`
3. Calcular `newScore = trust_score + delta`.
4. Si `newScore >= 10` y `trust_unlocked = false` → activar `trust_unlocked = true`.
5. Actualizar `trust_score` en `users`.
6. Evaluar si se debe aplicar suspensión (ver sección 3).

---

## 3. Sistema de suspensiones

### 3a. Tabla de suspensiones

| trust_score resultante | Duración |
|---|---|
| -1 a -10 | 24 horas |
| ≤ -11 | 7 días |
| Después de cumplir una suspensión de 7 días y volver a negativo | Permanente |

### 3b. Lógica al aplicar suspensión

Dentro de `applyTrustDelta`, si `newScore < 0` e `is_suspended = false`:

```
if newScore < 0 AND NOT is_suspended:
  if suspension_count >= 1 (ya cumplió una de 7 días):
    is_suspended = true, suspension_end = NULL (permanente)
  elif newScore <= -11:
    is_suspended = true
    suspension_end = NOW() + 7 days
  else: (newScore entre -1 y -10)
    is_suspended = true
    suspension_end = NOW() + 24h
```

### 3c. Reset al expirar suspensión

Un check en el middleware de autenticación (`/api/auth/me` o similar):
- Si `is_suspended = true` y `suspension_end IS NOT NULL` y `suspension_end < NOW()`:
  - `trust_score = 0`
  - `is_suspended = false`
  - Si la suspensión fue de 7 días → `suspension_count += 1`
  - `trust_unlocked = false` (vuelve a fase lenta)

### 3d. Bloqueo de acciones

En los endpoints de crear post y crear comentario:
- Leer `is_suspended` y `suspension_end` del usuario en sesión.
- Si suspendido y no expirado → `403` con mensaje apropiado.

---

## 4. Endpoints nuevos y modificados

| Endpoint | Cambio |
|---|---|
| `POST /api/posts` | Chequear suspensión antes de crear. Al crear post, no delta (el delta viene de votos). |
| `PATCH /api/posts/[id]/vote` | Al registrar voto `up`: `applyTrustDelta(postAuthor, +2)`. Al registrar voto `down`: `applyTrustDelta(postAuthor, -2)`. Detectar si el post alcanza 5 upvotes netos → `applyTrustDelta(postAuthor, +10)`. |
| `POST /api/posts/[id]/report` | Sin cambio en el delta directo. El delta ocurre cuando el post se oculta (ver siguiente). |
| `POST /api/posts/[id]/report` (cuando oculta) | Al ocultar el post: `applyTrustDelta(postAuthor, -15)`. Buscar todos los `reporter_id` en `reports` para ese post (formato `user:username`) → extraer username → `applyTrustDelta(reporter, +3)` a cada uno. Solo se recompensa a reportantes con cuenta (`user:` prefix), no a IPs anónimas. |
| `POST /api/posts/[id]/comments` | Chequear suspensión antes de crear. |
| `POST /api/posts/[id]/comments/[commentId]/vote` | Nuevo endpoint. Igual lógica que post vote pero sobre `comment_votes` y autor del comentario. |
| `GET /api/auth/me` | Incluir `trust_score`, `trust_unlocked`, `is_suspended`, `suspension_end` en la respuesta. Hacer el reset de suspensión expirada aquí. |

---

## 5. Display en UI

### 5a. Mostrar `?` vs número

- Si `trust_unlocked = false` → mostrar `Confianza: ?`
- Si `trust_unlocked = true` → mostrar `Confianza: {trust_score}`

Aplica en: `PostCard.tsx`, `posts/[id]/page.tsx`, `LocalComments.tsx`.

### 5b. Tooltip

```
"La confianza sube con votos positivos y baja con reportes o votos negativos."
```

Mostrar al hover sobre el badge de confianza usando el componente `Tooltip` de Mantine (ya importado).

### 5c. Mensaje de suspensión

Si el usuario intenta publicar o comentar y está suspendido:
- Temporal: `"Tu cuenta está suspendida hasta [fecha]. Revisa nuestras reglas."`
- Permanente: `"Tu cuenta ha sido suspendida permanentemente."`

---

## 6. Flujo de datos end-to-end (ejemplo: voto positivo)

```
Usuario A vota 👍 en post de Usuario B
  → PATCH /api/posts/[id]/vote
  → withTransaction:
      INSERT INTO votes ...
      UPDATE posts SET upvotes = upvotes + 1 ...
      SELECT anon_id FROM posts WHERE id = $1  (= username de B)
      applyTrustDelta('B', +2, client)
        → SELECT trust_score FROM users WHERE username = 'B' FOR UPDATE
        → score < 10? → delta = +1
        → UPDATE users SET trust_score = trust_score + 1 ...
        → score llegó a 10? → SET trust_unlocked = true
  → return { votes }
```

---

## 7. Casos borde explícitos

- **Auto-voto:** Un usuario no puede afectar su propio trust score votando su propio post/comentario. Si `voter_username === post.anon_id`, se registra el voto pero no se llama `applyTrustDelta`.
- **Post con 5 upvotes netos:** Se verifica DESPUÉS de actualizar los contadores. Si `upvotes - downvotes` pasa de 4 a 5 en esa transacción → se aplica el +10. Para evitar doble recompensa, se necesita una columna `milestone_5_rewarded BOOLEAN DEFAULT false` en `posts`.
- **Reporter_id de anónimos:** Los registros con `reporter_id` que empiezan con `anon:` (IP) no reciben recompensa. Solo `user:{username}`.
- **Suspensión ya activa:** Si el usuario ya está suspendido (`is_suspended = true` y no expiró), no se aplica una nueva suspensión aunque el score siga bajando.

---

## 8. Lo que NO cambia

- El sistema de anonimato visual (el `anon_id` generado para display). El trust score se guarda y opera sobre el `username` real, nunca expuesto.
- La lógica de rate limiting existente.
- El sistema de reportes de comentarios (`/api/posts/[id]/comments/[commentId]/report`) — no genera penalización de trust en esta versión.
- La columna `is_hidden` de posts y el umbral de ocultación automática (actualmente 10 reportes).
