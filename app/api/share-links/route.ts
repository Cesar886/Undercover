import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isUuid } from '@/lib/validation';
import { ensureVisibilitySchema, ownerTokenFromRequest } from '@/lib/visibility';
import { createShareToken, shareLinkTtlSeconds, verifyShareToken } from '@/lib/shareLinks';
import { publicOrigin } from '@/lib/publicOrigin';

export async function POST(request: NextRequest) {
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);

  let body: { kind?: unknown; postId?: unknown; commentId?: unknown; currentShareToken?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const kind = body.kind;
  const postId = body.postId;
  const commentId = body.commentId;
  if ((kind !== 'post' && kind !== 'comment') || typeof postId !== 'string' || !isUuid(postId)) {
    return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 });
  }
  if (kind === 'comment' && (typeof commentId !== 'string' || !isUuid(commentId))) {
    return NextResponse.json({ error: 'Comentario inválido' }, { status: 400 });
  }

  const currentGrant = verifyShareToken(
    typeof body.currentShareToken === 'string' ? body.currentShareToken : null
  );

  if (kind === 'post') {
    const result = await query(
      `SELECT owner_hidden, owner_token::text AS owner_token
       FROM posts WHERE id = $1 AND is_hidden = false`,
      [postId]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
    const row = result.rows[0];
    const hasExistingGrant = currentGrant?.postId === postId;
    if (row.owner_hidden && row.owner_token !== ownerToken && !hasExistingGrant) {
      return NextResponse.json({ error: 'No puedes compartir este post oculto' }, { status: 403 });
    }
  } else {
    const result = await query(
      `SELECT c.owner_hidden, c.owner_token::text AS owner_token,
              p.owner_hidden AS post_owner_hidden,
              p.owner_token::text AS post_owner_token
       FROM comments c JOIN posts p ON p.id = c.post_id
       WHERE c.id = $1 AND c.post_id = $2 AND c.is_hidden = false AND p.is_hidden = false`,
      [commentId, postId]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
    const row = result.rows[0];
    const hasExistingGrant = currentGrant?.kind === 'comment'
      && currentGrant.postId === postId && currentGrant.commentId === commentId;
    if (row.post_owner_hidden && row.post_owner_token !== ownerToken && !hasExistingGrant) {
      return NextResponse.json({ error: 'No puedes compartir contenido de este post oculto' }, { status: 403 });
    }
    if (row.owner_hidden && row.owner_token !== ownerToken && !hasExistingGrant) {
      return NextResponse.json({ error: 'No puedes compartir este comentario oculto' }, { status: 403 });
    }
  }

  const created = createShareToken({
    kind,
    postId,
    ...(kind === 'comment' ? { commentId: commentId as string } : {}),
  });
  const hash = kind === 'comment' ? `#comment-${commentId}` : '';
  const url = `${publicOrigin(request)}/posts/${postId}?share=${encodeURIComponent(created.token)}${hash}`;
  return NextResponse.json({ url, expiresAt: created.expiresAt, expiresInSeconds: shareLinkTtlSeconds() }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
