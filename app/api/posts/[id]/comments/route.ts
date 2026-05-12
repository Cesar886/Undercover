import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUsername, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';
import { emitFeed } from '@/lib/events';
import { validateCommentInput, isUuid } from '@/lib/validation';
import { validateAndConvertImage } from '@/lib/imageValidation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { formatSuspensionDate } from '@/lib/trust';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await getSessionUsername())) return unauthorized();

  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const result = await query(
    `SELECT c.*, u.trust_score, u.trust_unlocked
     FROM comments c
     LEFT JOIN users u ON u.username = c.anon_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [params.id]
  );
  return NextResponse.json({ comments: result.rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  let anonId: string;
  try {
    const raw = (await cookies()).get('session_user')?.value;
    if (!raw) return NextResponse.json({ error: 'Debes iniciar sesión para comentar' }, { status: 401 });
    anonId = JSON.parse(raw).username;
    if (!anonId) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Debes iniciar sesión para comentar' }, { status: 401 });
  }

  const suspCheck = await query(
    'SELECT is_suspended, suspension_end FROM users WHERE username = $1',
    [anonId]
  );
  const suspUser = suspCheck.rows[0];
  if (suspUser?.is_suspended) {
    const isActive = suspUser.suspension_end === null || new Date(suspUser.suspension_end) > new Date();
    if (isActive) {
      const msg = suspUser.suspension_end === null
        ? 'Tu cuenta ha sido suspendida permanentemente por reincidencia.'
        : `Tu cuenta está suspendida hasta ${formatSuspensionDate(suspUser.suspension_end)}. Revisa nuestras reglas para evitar futuras suspensiones.`;
      return NextResponse.json({ error: msg }, { status: 403 });
    }
  }

  const rl = checkRateLimit(`comments:user:${anonId}`, RATE_LIMITS.comments);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiados comentarios. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validateCommentInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  if (v.value.parent_id) {
    const parentCheck = await query(
      'SELECT id FROM comments WHERE id = $1 AND post_id = $2',
      [v.value.parent_id, params.id]
    );
    if (parentCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Comentario padre inválido' }, { status: 400 });
    }
  }

  let imageWebp: string | null = null;
  if (v.value.image) {
    const img = await validateAndConvertImage(v.value.image);
    if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
    imageWebp = img.webpDataUrl;
  }

  const result = await query(
    'INSERT INTO comments (post_id, parent_id, anon_id, content, image_webp) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [params.id, v.value.parent_id, anonId, v.value.content, imageWebp]
  );

  const comment = result.rows[0];
  emitFeed({ type: 'comment:new', postId: params.id, comment });

  return NextResponse.json({ comment }, { status: 201 });
}
