import { communitySuspension } from '@/lib/communityModeration';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isUuid, validateEditPostInput } from '@/lib/validation';
import { emitFeed } from '@/lib/events';
import { getAnonId } from '@/lib/anon';
import { attachPollsToPosts, getPollForPost, publicPoll } from '@/lib/polls';
import { Post } from '@/types';
import { ensureVisibilitySchema, ownerTokenFromRequest, publicOwnedRow } from '@/lib/visibility';
import { shareGrantCoversPost, verifyShareToken } from '@/lib/shareLinks';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);
  const suppliedShareToken = request.nextUrl.searchParams.get('share');
  const shareGrant = verifyShareToken(suppliedShareToken);
  if (suppliedShareToken && !shareGrant) {
    return NextResponse.json({ error: 'Este enlace compartido expiró' }, { status: 410 });
  }

  // Hidden posts require either the persistent owner token or a valid signed share link:
  const result = await query(
    `SELECT p.*,
      (SELECT COUNT(*) FROM comments c
       WHERE c.post_id = p.id AND c.is_hidden = false
         AND (c.owner_hidden = false OR c.owner_token = $2::uuid))::int AS comment_count
     FROM posts p
     WHERE p.id = $1 AND p.is_hidden = false`,
    [params.id, ownerToken]
  );
  if (result.rows.length === 0) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  const rawPost = result.rows[0];
  const ownsPost = Boolean(ownerToken && rawPost.owner_token === ownerToken);
  if (rawPost.owner_hidden && !ownsPost && !shareGrantCoversPost(shareGrant, params.id)) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  const safe = publicOwnedRow(result.rows[0], ownerToken) as unknown as Post;
  const viewerAnonId = ownerToken ? getAnonId(request).anonId : null;
  const [post] = await attachPollsToPosts([safe], viewerAnonId);
  return NextResponse.json({ post }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);
  const { anonId } = getAnonId(request);
  const suspended = await communitySuspension(anonId);
  if (suspended) return suspended;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const validated = validateEditPostInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: validated.status });

  const owner = await query('SELECT anon_id FROM posts WHERE id = $1 AND is_hidden = false', [params.id]);
  if (owner.rows.length === 0) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  if (owner.rows[0].anon_id !== anonId) return NextResponse.json({ error: 'No eres el autor' }, { status: 403 });

  const result = await query(
    `UPDATE posts SET content = $1, updated_at = NOW() WHERE id = $2 AND is_hidden = false RETURNING *`,
    [validated.value.content, params.id]
  );
  if (!result.rows.length) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  const safe = publicOwnedRow(result.rows[0], ownerToken) as unknown as Post;
  const post: Post = { ...safe, poll: await getPollForPost(params.id, anonId) };
  if (!post.owner_hidden) emitFeed({ type: 'post:edited', post: { ...post, is_owner: false, poll: post.poll ? publicPoll(post.poll) : null } });
  return NextResponse.json({ post }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const { anonId } = getAnonId(request);
  const owner = await query('SELECT anon_id FROM posts WHERE id = $1', [params.id]);
  if (owner.rows.length === 0) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  if (owner.rows[0].anon_id !== anonId) return NextResponse.json({ error: 'No eres el autor' }, { status: 403 });

  await query(`UPDATE posts SET content = '', image_webp = NULL, is_hidden = TRUE WHERE id = $1`, [params.id]);
  emitFeed({ type: 'post:hidden', postId: params.id });
  return NextResponse.json({ success: true });
}
