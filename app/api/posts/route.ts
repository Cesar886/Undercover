import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { generateAnonId } from '@/lib/hash';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { emitFeed } from '@/lib/events';
import { validatePostInput } from '@/lib/validation';
import { validateAndConvertImage } from '@/lib/imageValidation';
import { PostCategory } from '@/types';

const VALID_CATEGORIES: PostCategory[] = ['general', 'quemones', 'infieles', 'confesiones'];
const VALID_SORTS = ['recent', 'top', 'hot'] as const;
type SortOption = typeof VALID_SORTS[number];

function buildOrderClause(sort: SortOption): string {
  if (sort === 'top') return 'ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC';
  if (sort === 'hot') return 'ORDER BY (p.upvotes + p.downvotes) DESC, p.created_at DESC';
  return 'ORDER BY p.created_at DESC';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') as PostCategory | null;
  const rawSort = searchParams.get('sort') ?? 'recent';
  const sort: SortOption = VALID_SORTS.includes(rawSort as SortOption) ? (rawSort as SortOption) : 'recent';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;
  const offset = (page - 1) * limit;

  const q = searchParams.get('q')?.trim() ?? '';

  const params: unknown[] = [];
  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count
    FROM posts p
    WHERE p.is_hidden = false
  `;

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

  sql += ` ${buildOrderClause(sort)} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return NextResponse.json({ posts: result.rows, page, limit });
}

export async function POST(request: NextRequest) {
  // Sesión requerida y usada como clave de rate-limit (no IP — todos comparten IP en la uni).
  let username: string | null = null;
  try {
    const sessionRaw = (await cookies()).get('session_user')?.value;
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (typeof parsed.username === 'string' && parsed.username.trim()) {
        username = parsed.username.trim();
      }
    }
  } catch {
    // sin sesión válida
  }

  const rateKey = username ? `posts:user:${username}` : `posts:anon:${request.headers.get('x-forwarded-for') ?? '0.0.0.0'}`;
  const rl = checkRateLimit(rateKey, RATE_LIMITS.posts);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiados posts. Intenta más tarde.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validatePostInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  let imageWebp: string | null = null;
  if (v.value.image) {
    const img = await validateAndConvertImage(v.value.image);
    if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
    imageWebp = img.webpDataUrl;
  }

  const anonId = username ?? generateAnonId();

  const result = await query(
    `INSERT INTO posts (anon_id, content, category, image_webp) VALUES ($1, $2, $3, $4) RETURNING *`,
    [anonId, v.value.content, v.value.category, imageWebp]
  );

  const post = { ...result.rows[0], comment_count: 0 };
  emitFeed({ type: 'post:new', post });

  return NextResponse.json({ post: result.rows[0] }, { status: 201 });
}
