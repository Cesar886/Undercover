import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { emitFeed } from '@/lib/events';
import { validatePostInput } from '@/lib/validation';
import { validateAndConvertImage } from '@/lib/imageValidation';
import { PostCategory } from '@/types';
import { getAnonId, setAnonCookie } from '@/lib/anon';
import { pruneCategory } from '@/lib/ephemeral';
import { getRealIp, getBanStatus, banMessage } from '@/lib/ipban';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: PostCategory[] = ['general', 'quemones', 'infieles', 'confesiones'];
const VALID_SORTS = ['recent', 'top', 'hot'] as const;
type SortOption = typeof VALID_SORTS[number];

function buildOrderClause(sort: SortOption): string {
  // "recent" sorts by bump order (last reply first), matching 4chan behavior
  if (sort === 'top') return 'ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC';
  if (sort === 'hot') return 'ORDER BY (p.upvotes + p.downvotes) DESC, p.created_at DESC';
  return 'ORDER BY p.last_bumped_at DESC, p.created_at DESC';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category  = searchParams.get('category') as PostCategory | null;
  const rawSort   = searchParams.get('sort') ?? 'recent';
  const sort: SortOption = VALID_SORTS.includes(rawSort as SortOption) ? (rawSort as SortOption) : 'recent';
  const page      = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const archived  = searchParams.get('archived') === 'true';
  const limit     = 10;
  const offset    = (page - 1) * limit;
  const q         = searchParams.get('q')?.trim() ?? '';

  const params: unknown[] = [];
  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count
    FROM posts p
    WHERE p.is_hidden = false
      AND p.archived = $${params.length + 1}
  `;
  params.push(archived);

  if (q) {
    params.push(`%${q}%`);
    sql += ` AND p.content ILIKE $${params.length}`;
  }

  if (category && VALID_CATEGORIES.includes(category)) {
    params.push(category);
    sql += ` AND p.category = $${params.length}`;
  }

  if (sort === 'top') {
    sql += ` AND p.created_at > NOW() - INTERVAL '7 days'`;
  }

  // Archive uses score order; live board uses bump/hot/top
  const order = archived
    ? 'ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC'
    : buildOrderClause(sort);

  sql += ` ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  console.log('[GET /api/posts] archived:', archived, '| count:', result.rows.length, '| ids:', result.rows.map((r: {id:string}) => r.id.slice(0,8)).join(','));
  return NextResponse.json({ posts: result.rows, page, limit });
}

export async function POST(request: NextRequest) {
  console.log('[POST /api/posts] request received');

  const ip = getRealIp(request);
  const ban = await getBanStatus(ip);
  if (ban.banned) {
    return NextResponse.json({ error: banMessage(ban.expiresAt) }, { status: 403 });
  }

  let anonId: string;
  let newToken: string | undefined;
  try {
    ({ anonId, newToken } = getAnonId(request));
    console.log('[POST /api/posts] anonId derived:', anonId.slice(0, 8) + '...');
  } catch (err) {
    console.error('[POST /api/posts] getAnonId failed:', err);
    return NextResponse.json({ error: 'Error de identidad anónima' }, { status: 500 });
  }

  const rl = checkRateLimit(`posts:anon:${anonId}`, RATE_LIMITS.posts);
  if (!rl.ok) {
    console.log('[POST /api/posts] rate limited');
    return NextResponse.json(
      { error: 'Demasiados posts. Intenta más tarde.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
    console.log('[POST /api/posts] body parsed:', JSON.stringify(body).slice(0, 100));
  } catch (err) {
    console.error('[POST /api/posts] JSON parse failed:', err);
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validatePostInput(body);
  if (!v.ok) {
    console.log('[POST /api/posts] validation failed:', v.error);
    return NextResponse.json({ error: v.error }, { status: v.status });
  }
  console.log('[POST /api/posts] validation ok, category:', v.value.category);

  let imageWebp: string | null = null;
  if (v.value.image) {
    const img = await validateAndConvertImage(v.value.image);
    if (!img.ok) {
      console.log('[POST /api/posts] image validation failed:', img.error);
      return NextResponse.json({ error: img.error }, { status: 400 });
    }
    imageWebp = img.webpDataUrl;
    console.log('[POST /api/posts] image ok');
  }

  let post: unknown;
  try {
    ({ post } = await withTransaction(async (client) => {
      console.log('[POST /api/posts] inserting...');
      const insertRes = await client.query(
        `INSERT INTO posts (anon_id, content, category, image_webp, poster_ip)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [anonId, v.value.content, v.value.category, imageWebp, ip]
      );
      const post = { ...insertRes.rows[0], comment_count: 0 };
      console.log('[POST /api/posts] inserted, id:', post.id);
      await pruneCategory(v.value.category, client);
      console.log('[POST /api/posts] pruneCategory done');
      return { post };
    }));
  } catch (err) {
    console.error('[POST /api/posts] DB error:', err);
    return NextResponse.json({ error: 'Error al guardar el post' }, { status: 500 });
  }

  emitFeed({ type: 'post:new', post });
  console.log('[POST /api/posts] emitFeed done, returning 201');

  const res = NextResponse.json({ post }, { status: 201 });
  if (newToken) setAnonCookie(res, newToken);
  return res;
}
