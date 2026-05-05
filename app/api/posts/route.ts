import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitize } from '@/lib/sanitize';
import { generateAnonId } from '@/lib/hash';
import { checkRateLimit } from '@/lib/rateLimit';
import { PostCategory } from '@/types';

const VALID_CATEGORIES: PostCategory[] = ['quemones', 'infieles', 'confesiones', 'rumores'];
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

  const params: unknown[] = [];
  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count
    FROM posts p
    WHERE p.is_hidden = false
  `;

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
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiados posts. Intenta más tarde.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const content = sanitize(body.content ?? '');
  const rawCategory = body.category;

  if (!content || content.length > 500) {
    return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(rawCategory as PostCategory)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
  }

  const category = rawCategory as PostCategory;

  const anonId = generateAnonId();
  const result = await query(
    `INSERT INTO posts (anon_id, content, category) VALUES ($1, $2, $3) RETURNING *`,
    [anonId, content, category]
  );

  return NextResponse.json({ post: result.rows[0] }, { status: 201 });
}
