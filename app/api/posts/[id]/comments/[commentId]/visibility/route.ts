import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isUuid } from '@/lib/validation';
import { ensureVisibilitySchema, ownerTokenFromRequest, publicOwnedRow } from '@/lib/visibility';
import type { Comment } from '@/types';
import { emitFeed } from '@/lib/events';

export async function PATCH(request: NextRequest, { params }: { params: { id: string; commentId: string } }) {
  if (!isUuid(params.id) || !isUuid(params.commentId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);
  if (!ownerToken) return NextResponse.json({ error: 'Token de propiedad inválido' }, { status: 403 });

  let hidden: unknown;
  try { hidden = (await request.json() as { hidden?: unknown }).hidden; }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (typeof hidden !== 'boolean') return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });

  const result = await query(
    `UPDATE comments SET owner_hidden = $1, updated_at = NOW()
     WHERE id = $2 AND post_id = $3 AND owner_token = $4::uuid
       AND is_hidden = false AND is_deleted = false
     RETURNING *`,
    [hidden, params.commentId, params.id, ownerToken]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Comentario no encontrado o token de propiedad incorrecto' }, { status: 403 });
  }
  const comment = publicOwnedRow(result.rows[0], ownerToken) as unknown as Comment;
  emitFeed({ type: 'comment:visibility', postId: params.id, commentId: params.commentId, hidden });
  return NextResponse.json({ comment }, { headers: { 'Cache-Control': 'no-store' } });
}
