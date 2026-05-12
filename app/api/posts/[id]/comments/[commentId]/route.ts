import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { isUuid, validateEditCommentInput } from '@/lib/validation';
import { emitFeed } from '@/lib/events';
import { getSessionUsername, unauthorized } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  if (!isUuid(params.id) || !isUuid(params.commentId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const username = await getSessionUsername();
  if (!username) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validateEditCommentInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const owner = await query(
    'SELECT anon_id, is_deleted FROM comments WHERE id = $1 AND post_id = $2',
    [params.commentId, params.id]
  );
  if (owner.rows.length === 0) {
    return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
  }
  if (owner.rows[0].anon_id !== username) {
    return NextResponse.json({ error: 'No eres el autor' }, { status: 403 });
  }
  if (owner.rows[0].is_deleted) {
    return NextResponse.json(
      { error: 'No se puede editar un comentario eliminado' },
      { status: 409 }
    );
  }

  const result = await query(
    `UPDATE comments
     SET content = $1, updated_at = NOW()
     WHERE id = $2 AND is_deleted = false
     RETURNING *`,
    [v.value.content, params.commentId]
  );

  const comment = result.rows[0];
  emitFeed({ type: 'comment:edited', postId: params.id, comment });

  return NextResponse.json({ comment });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  if (!isUuid(params.id) || !isUuid(params.commentId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const username = await getSessionUsername();
  if (!username) return unauthorized();

  const result = await withTransaction(async (client) => {
    const lock = await client.query(
      'SELECT anon_id FROM comments WHERE id = $1 AND post_id = $2 FOR UPDATE',
      [params.commentId, params.id]
    );
    if (lock.rows.length === 0) return { kind: 'notfound' as const };
    if (lock.rows[0].anon_id !== username) return { kind: 'forbidden' as const };

    const replies = await client.query(
      'SELECT EXISTS(SELECT 1 FROM comments WHERE parent_id = $1) AS has_replies',
      [params.commentId]
    );
    const hasReplies: boolean = replies.rows[0].has_replies;

    if (hasReplies) {
      await client.query(
        `UPDATE comments
         SET is_deleted = true, content = '', image_webp = NULL
         WHERE id = $1`,
        [params.commentId]
      );
      return { kind: 'soft' as const };
    }

    await client.query('DELETE FROM comments WHERE id = $1', [params.commentId]);
    return { kind: 'hard' as const };
  });

  if (result.kind === 'notfound') {
    return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
  }
  if (result.kind === 'forbidden') {
    return NextResponse.json({ error: 'No eres el autor' }, { status: 403 });
  }

  emitFeed({
    type: 'comment:deleted',
    postId: params.id,
    commentId: params.commentId,
    soft: result.kind === 'soft',
  });

  return NextResponse.json({ success: true, soft: result.kind === 'soft' });
}
