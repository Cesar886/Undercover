import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isUuid, validateEditPostInput } from '@/lib/validation';
import { emitFeed } from '@/lib/events';
import { getSessionUsername, unauthorized } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await getSessionUsername())) return unauthorized();

  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const result = await query(
    `SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count,
      u.trust_score,
      u.trust_unlocked
     FROM posts p
     LEFT JOIN users u ON u.username = p.anon_id
     WHERE p.id = $1 AND p.is_hidden = false`,
    [params.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ post: result.rows[0] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const username = await getSessionUsername();
  if (!username) {
    return NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validateEditPostInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const owner = await query('SELECT anon_id FROM posts WHERE id = $1', [params.id]);
  if (owner.rows.length === 0) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }
  if (owner.rows[0].anon_id !== username) {
    return NextResponse.json({ error: 'No eres el autor' }, { status: 403 });
  }

  const result = await query(
    `UPDATE posts
     SET content = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [v.value.content, params.id]
  );

  const post = result.rows[0];
  emitFeed({ type: 'post:edited', post });

  return NextResponse.json({ post });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const username = await getSessionUsername();
  if (!username) {
    return NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 });
  }

  const owner = await query('SELECT anon_id FROM posts WHERE id = $1', [params.id]);
  if (owner.rows.length === 0) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }
  if (owner.rows[0].anon_id !== username) {
    return NextResponse.json({ error: 'No eres el autor' }, { status: 403 });
  }

  await query('DELETE FROM posts WHERE id = $1', [params.id]);
  emitFeed({ type: 'post:hidden', postId: params.id });

  return NextResponse.json({ success: true });
}
