import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { emitFeed } from '@/lib/events';
import { validatePostInput } from '@/lib/validation';
import { validateAndConvertImage } from '@/lib/imageValidation';
import { PostCategory } from '@/types';
import { formatSuspensionDate } from '@/lib/trust';
import { getSessionUsername, unauthorized } from '@/lib/auth';

const VALID_CATEGORIES: PostCategory[] = ['general', 'quemones', 'infieles', 'confesiones'];
const VALID_SORTS = ['recent', 'top', 'hot'] as const;
type SortOption = typeof VALID_SORTS[number];

function buildOrderClause(sort: SortOption): string {
  if (sort === 'top') return 'ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC';
  if (sort === 'hot') return 'ORDER BY (p.upvotes + p.downvotes) DESC, p.created_at DESC';
  return 'ORDER BY p.created_at DESC';
}

export async function GET(request: NextRequest) {
  if (!(await getSessionUsername())) return unauthorized();

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
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count,
      u.trust_score,
      u.trust_unlocked
    FROM posts p
    LEFT JOIN users u ON u.username = p.anon_id
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
  const username = await getSessionUsername();
  if (!username) return unauthorized();

  const rateKey = `posts:user:${username}`;
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

  const anonId = username;

  if (username) {
    const suspCheck = await query(
      'SELECT is_suspended, suspension_end FROM users WHERE username = $1',
      [username]
    );
    const user = suspCheck.rows[0];
    if (user?.is_suspended) {
      const isActive = user.suspension_end === null || new Date(user.suspension_end) > new Date();
      if (isActive) {
        const msg = user.suspension_end === null
          ? 'Tu cuenta ha sido suspendida permanentemente por reincidencia.'
          : `Tu cuenta está suspendida hasta ${formatSuspensionDate(user.suspension_end)}. Revisa nuestras reglas para evitar futuras suspensiones.`;
        return NextResponse.json({ error: msg }, { status: 403 });
      }
    }
  }

  const result = await query(
    `INSERT INTO posts (anon_id, content, category, image_webp) VALUES ($1, $2, $3, $4) RETURNING *`,
    [anonId, v.value.content, v.value.category, imageWebp]
  );

  const post = { ...result.rows[0], comment_count: 0 };
  emitFeed({ type: 'post:new', post });

  return NextResponse.json({ post: result.rows[0] }, { status: 201 });
}
