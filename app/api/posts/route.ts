import { feedVerified, persistFeedVerification } from '@/lib/feedVerification';
import { communitySuspension } from '@/lib/communityModeration';
import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { emitFeed } from '@/lib/events';
import { validatePostInput } from '@/lib/validation';
import { validateAndConvertImage } from '@/lib/imageValidation';
import { ensureImageReviewSchema, queueImage } from '@/lib/imageReviews';
import { Post, PostCategory } from '@/types';
import { getAnonId } from '@/lib/anon';
import { pruneCategory } from '@/lib/ephemeral';
import { categoryExists } from '@/lib/categories';
import { attachPollsToPosts, createPollForPost, ensurePollSchema, getPollForPost, publicPoll } from '@/lib/polls';
import { ensureVisibilitySchema, ownerTokenFromRequest, publicOwnedRow } from '@/lib/visibility';
import { createDevPost, devMemoryEnabled, listDevPosts } from '@/lib/devMemoryStore';
import { shouldHideContent } from '@/lib/keywordModeration';

export const dynamic = 'force-dynamic';
const VALID_SORTS = ['recent', 'top', 'hot'] as const;
type SortOption = typeof VALID_SORTS[number];

function requestIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')?.trim()
    || null;
}

function buildOrderClause(sort: SortOption, alias = 'p'): string {
  if (sort === 'top') return `ORDER BY (${alias}.upvotes - ${alias}.downvotes) DESC, ${alias}.created_at DESC`;
  if (sort === 'hot') return `ORDER BY (${alias}.upvotes + ${alias}.downvotes) DESC, ${alias}.created_at DESC`;
  return `ORDER BY ${alias}.last_bumped_at DESC, ${alias}.created_at DESC`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureVisibilitySchema();
    const ownerToken = ownerTokenFromRequest(request);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as PostCategory | null;
    const rawSort = searchParams.get('sort') ?? 'recent';
    const sort: SortOption = VALID_SORTS.includes(rawSort as SortOption) ? rawSort as SortOption : 'recent';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const archived = searchParams.get('archived') === 'true';
    const limit = 10;
    const offset = (page - 1) * limit;
    const q = searchParams.get('q')?.trim() ?? '';

    const validCategory = category ? await categoryExists(category) : false;
    if (category && !validCategory) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    const params: unknown[] = [ownerToken];
    let sql = `
      WITH page_posts AS (
        SELECT p.*, u.trust_score, u.trust_unlocked
        FROM posts p
        LEFT JOIN users u ON u.username = p.anon_id
        WHERE p.is_hidden = false
          AND (p.owner_hidden = false OR p.owner_token = $1::uuid)
          AND p.archived = $${params.length + 1}
    `;
    params.push(archived);

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND p.content ILIKE $${params.length}`;
    }
    if (category && validCategory) {
      params.push(category);
      sql += ` AND p.category = $${params.length}`;
    } else if (!category) {
      sql += ` AND p.category != 'stickers'`;
    }
    if (sort === 'top') sql += ` AND p.created_at > NOW() - INTERVAL '7 days'`;

    const order = archived
      ? 'ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC'
      : buildOrderClause(sort);
    const outerOrder = archived
      ? 'ORDER BY (pp.upvotes - pp.downvotes) DESC, pp.created_at DESC'
      : buildOrderClause(sort, 'pp');
    sql += ` ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      ),
      comment_counts AS (
        SELECT c.post_id, COUNT(*)::int AS comment_count
        FROM comments c
        JOIN page_posts pp ON pp.id = c.post_id
        WHERE c.is_hidden = false
          AND c.is_deleted = false
          AND (c.owner_hidden = false OR c.owner_token = $1::uuid)
        GROUP BY c.post_id
      )
      SELECT pp.*, COALESCE(cc.comment_count, 0)::int AS comment_count
      FROM page_posts pp
      LEFT JOIN comment_counts cc ON cc.post_id = pp.id
      ${outerOrder}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const safeRows = result.rows.map((row) => publicOwnedRow(row, ownerToken)) as unknown as Post[];
    const viewerAnonId = ownerToken ? getAnonId(request).anonId : null;
    const posts = await attachPollsToPosts(safeRows, viewerAnonId);
    return NextResponse.json({ posts, page, limit }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (devMemoryEnabled()) {
      const ownerToken = ownerTokenFromRequest(request);
      const { searchParams } = new URL(request.url);
      const category = searchParams.get('category') as PostCategory;
      return NextResponse.json(
        { posts: listDevPosts(ownerToken, category), page: 1, limit: 10, databaseUnavailable: true, devMemoryFallback: true },
        { headers: { 'Cache-Control': 'no-store' } }
      ), anonId, verified);
    }
    return NextResponse.json(
      { posts: [], page: 1, limit: 10, databaseUnavailable: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  await ensureVisibilitySchema();
  const ownerToken = ownerTokenFromRequest(request);
  if (!ownerToken) {
    return NextResponse.json({ error: 'Token de propiedad inválido o ausente' }, { status: 400 });
  }

  let anonId: string;
  try {
    ({ anonId } = getAnonId(request));
  } catch {
    return NextResponse.json({ error: 'Error de identidad anónima' }, { status: 500 });
  }

  let suspended = null;
  try {
    suspended = await communitySuspension(anonId);
  } catch (error) {
    if (!devMemoryEnabled()) throw error;
  }
  if (suspended) return suspended;

  const rl = checkRateLimit(`posts:anon:${anonId}`, RATE_LIMITS.posts);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Demasiados posts. Intenta más tarde.' }, {
      status: 429, headers: { 'Retry-After': String(rl.retryAfter) },
    });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const validated = validatePostInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: validated.status });
  if (!(await categoryExists(validated.value.category))) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
  }

  const verified = feedVerified(request, anonId, validated.value.content);
  const ownerHidden = shouldHideContent(validated.value.content);

  let pendingImage: string | null = null;
  let pendingImageMetadata: Record<string, unknown> = {};
  if (validated.value.image) {
    const image = await validateAndConvertImage(validated.value.image, validated.value.category, { uploaderIp: requestIp(request) });
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });
    pendingImage = image.webpDataUrl;
    pendingImageMetadata = image.metadata;
    await ensureImageReviewSchema();
  }

  let created: Post | null = null;
  try {
    created = await withTransaction(async (client) => {
      await ensurePollSchema(client);
      const inserted = await client.query<Post>(
        `INSERT INTO posts (anon_id, content, category, image_webp, owner_token, owner_hidden, verified)
         VALUES ($1, $2, $3, $4, $5::uuid, $6, $7) RETURNING *`,
        [anonId, validated.value.content, validated.value.category, null, ownerToken, ownerHidden, verified]
      );
      let post: Post = { ...inserted.rows[0], comment_count: 0, poll: null };
      if (pendingImage && !ownerHidden) {
        await queueImage(client, 'post', post.id, pendingImage, pendingImageMetadata);
      }
      if (validated.value.poll_options?.length && !ownerHidden) {
        await createPollForPost(client, post.id, validated.value.poll_options, validated.value.poll_question ?? '');
        post = { ...post, poll: await getPollForPost(post.id, anonId, client) };
      }
      if (!ownerHidden) await pruneCategory(validated.value.category, client);
      return post;
    });
  } catch (error) {
    console.error('[POST /api/posts] DB error:', error);
    if (devMemoryEnabled() && !pendingImage && !validated.value.poll_options?.length) {
      const fallbackPost = createDevPost({
        anonId,
        ownerToken,
        content: validated.value.content,
        category: validated.value.category,
        ownerHidden,
        verified,
      });
      if (!ownerHidden) emitFeed({ type: 'post:new', post: { ...fallbackPost, is_owner: false, poll: null } });
      return persistFeedVerification(NextResponse.json(
        { post: fallbackPost, image_status: null, devMemoryFallback: true },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json({ error: 'Error al guardar el post' }, { status: 500 });
  }

  if (!created) return NextResponse.json({ error: 'Error al guardar el post' }, { status: 500 });
  const post = publicOwnedRow(created as unknown as Record<string, unknown>, ownerToken) as unknown as Post;
  if (!post.is_hidden && !post.owner_hidden) {
    emitFeed({ type: 'post:new', post: { ...post, is_owner: false, poll: post.poll ? publicPoll(post.poll) : null } });
  }

  const response = NextResponse.json({ post, image_status: pendingImage && !post.owner_hidden ? 'pending' : null }, {
    status: 201, headers: { 'Cache-Control': 'no-store' },
  });
  return persistFeedVerification(response, anonId, verified);
}
