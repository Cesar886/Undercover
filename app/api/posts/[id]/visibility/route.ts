import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isUuid } from '@/lib/validation';
import { ensureVisibilitySchema, ownerTokenFromRequest, publicOwnedRow } from '@/lib/visibility';
import type { Post } from '@/types';
import { emitFeed } from '@/lib/events';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);
  if (!ownerToken) return NextResponse.json({ error: 'Token de propiedad inválido' }, { status: 403 });

  let hidden: unknown;
  try { hidden = (await request.json() as { hidden?: unknown }).hidden; }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (typeof hidden !== 'boolean') return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });

  const result = await query(
    `UPDATE posts SET owner_hidden = $1, updated_at = NOW()
     WHERE id = $2 AND owner_token = $3::uuid AND is_hidden = false
     RETURNING *`,
    [hidden, params.id, ownerToken]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Post no encontrado o token de propiedad incorrecto' }, { status: 403 });
  }
  const post = publicOwnedRow(result.rows[0], ownerToken) as unknown as Post;
  emitFeed({ type: 'post:visibility', postId: params.id, hidden });
  return NextResponse.json({ post }, { headers: { 'Cache-Control': 'no-store' } });
}
