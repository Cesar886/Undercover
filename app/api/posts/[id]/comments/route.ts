import { communitySuspension } from '@/lib/communityModeration';
import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { validateAndConvertImage } from '@/lib/imageValidation';
import { ensureImageReviewSchema, queueImage } from '@/lib/imageReviews';
import { emitFeed } from '@/lib/events';
import { validateCommentInput, isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { getAnonId } from '@/lib/anon';
import { ensureVisibilitySchema, ownerTokenFromRequest, publicOwnedRow } from '@/lib/visibility';
import type { Comment } from '@/types';
import { shareGrantCoversComment, shareGrantCoversPost, verifyShareToken } from '@/lib/shareLinks';
import { shouldHideCommentContent } from '@/lib/keywordModeration';

function requestIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')?.trim()
    || null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);
  const direct = request.nextUrl.searchParams.get('direct');
  const directCommentId = direct && isUuid(direct) ? direct : null;
  const suppliedShareToken = request.nextUrl.searchParams.get('share');
  const shareGrant = verifyShareToken(suppliedShareToken);
  if (suppliedShareToken && !shareGrant) {
    return NextResponse.json({ error: 'Este enlace compartido expiró' }, { status: 410 });
  }
  const postResult = await query(
    'SELECT owner_hidden, owner_token::text AS owner_token FROM posts WHERE id = $1 AND is_hidden = false',
    [params.id]
  );
  if (postResult.rows.length === 0) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  const post = postResult.rows[0];
  const ownsPost = Boolean(ownerToken && post.owner_token === ownerToken);
  if (post.owner_hidden && !ownsPost && !shareGrantCoversPost(shareGrant, params.id)) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  const directAccess = Boolean(directCommentId && shareGrantCoversComment(shareGrant, params.id, directCommentId));

  const result = await query(
    `SELECT c.*, u.trust_score, u.trust_unlocked
     FROM comments c
     LEFT JOIN users u ON u.username = c.anon_id
     WHERE c.post_id = $1 AND c.is_hidden = false
       AND (c.owner_hidden = false OR c.owner_token = $2::uuid OR (c.id = $3::uuid AND $4::boolean))
     ORDER BY c.created_at ASC`,
    [params.id, ownerToken, directCommentId, directAccess]
  );
  const comments = result.rows.map((row) => publicOwnedRow(row, ownerToken)) as unknown as Comment[];
  return NextResponse.json({ comments }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);
  if (!ownerToken) return NextResponse.json({ error: 'Token de propiedad inválido o ausente' }, { status: 400 });

  const postCheck = await query(`SELECT archived FROM posts WHERE id = $1 AND is_hidden = false`, [params.id]);
  if (postCheck.rows.length === 0) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  if (postCheck.rows[0].archived) return NextResponse.json({ error: 'Este hilo está archivado.' }, { status: 403 });

  const { anonId } = getAnonId(request);
  const suspended = await communitySuspension(anonId);
  if (suspended) return suspended;
  const rate = checkRateLimit(`comments:anon:${anonId}`, RATE_LIMITS.comments);
  if (!rate.ok) {
    return NextResponse.json({ error: 'Demasiados comentarios. Espera un momento.' }, {
      status: 429, headers: { 'Retry-After': String(rate.retryAfter) },
    });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const validated = validateCommentInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: validated.status });

  if (validated.value.parent_id) {
    const parent = await query(
      `SELECT id FROM comments WHERE id = $1 AND post_id = $2 AND is_hidden = false`,
      [validated.value.parent_id, params.id]
    );
    if (parent.rows.length === 0) return NextResponse.json({ error: 'Comentario padre inválido' }, { status: 400 });
  }

  let pendingImage: string | null = null;
  let pendingImageMetadata: Record<string, unknown> = {};
  if (validated.value.image) {
    const image = await validateAndConvertImage(validated.value.image, undefined, { uploaderIp: requestIp(request) });
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });
    pendingImage = image.webpDataUrl;
    pendingImageMetadata = image.metadata;
    await ensureImageReviewSchema();
  }

  const inserted = await withTransaction(async (client) => {
    const ownerHidden = shouldHideCommentContent(validated.value.content);
    const result = await client.query(
      `INSERT INTO comments (post_id, parent_id, anon_id, content, image_webp, owner_token, owner_hidden)
       VALUES ($1, $2, $3, $4, $5, $6::uuid, $7)
       RETURNING *,
         (SELECT trust_score FROM users WHERE username = $3) AS trust_score,
         (SELECT trust_unlocked FROM users WHERE username = $3) AS trust_unlocked`,
      [params.id, validated.value.parent_id, anonId, validated.value.content, null, ownerToken, ownerHidden]
    );
    if (pendingImage && !ownerHidden) {
      await queueImage(client, 'comment', result.rows[0].id, pendingImage, pendingImageMetadata);
    }
    return result.rows[0];
  });

  if (!inserted.is_hidden && !inserted.owner_hidden) {
    await query(`UPDATE posts SET last_bumped_at = NOW() WHERE id = $1 AND archived = FALSE`, [params.id]);
  }
  const comment = publicOwnedRow(inserted, ownerToken) as unknown as Comment;
  if (!comment.is_hidden && !comment.owner_hidden) {
    emitFeed({ type: 'comment:new', postId: params.id, comment: { ...comment, is_owner: false } });
  }

  const response = NextResponse.json({ comment, image_status: pendingImage && !comment.is_hidden && !comment.owner_hidden ? 'pending' : null }, {
    status: 201, headers: { 'Cache-Control': 'no-store' },
  });
  return response;
}
