import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { emitFeed } from '@/lib/events';
import { validateCommentInput, isUuid } from '@/lib/validation';
import { validateAndConvertImage } from '@/lib/imageValidation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { getAnonId, setAnonCookie } from '@/lib/anon';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const result = await query(
    `SELECT c.* FROM comments c WHERE c.post_id = $1 ORDER BY c.created_at ASC`,
    [params.id]
  );
  return NextResponse.json({ comments: result.rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  // Reject comments on archived threads
  const postCheck = await query(
    `SELECT archived FROM posts WHERE id = $1`,
    [params.id]
  );
  if (postCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }
  if (postCheck.rows[0].archived) {
    return NextResponse.json({ error: 'Este hilo está archivado.' }, { status: 403 });
  }

  const { anonId, newToken } = getAnonId(request);

  const rl = checkRateLimit(`comments:anon:${anonId}`, RATE_LIMITS.comments);
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

  // Bump the parent thread so it rises in the feed (4chan-style bump)
  await query(
    `UPDATE posts SET last_bumped_at = NOW() WHERE id = $1 AND archived = FALSE`,
    [params.id]
  );

  const comment = result.rows[0];
  emitFeed({ type: 'comment:new', postId: params.id, comment });

  const res = NextResponse.json({ comment }, { status: 201 });
  if (newToken) setAnonCookie(res, newToken);
  return res;
}
