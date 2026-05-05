import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitize } from '@/lib/sanitize';
import { generateAnonId } from '@/lib/hash';
import { checkRateLimit } from '@/lib/rateLimit';
import { PostCategory } from '@/types';

const VALID_CATEGORIES: PostCategory[] = ['quemones', 'infieles', 'confesiones', 'rumores'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') as PostCategory | null;
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

  sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
  const category: PostCategory = body.category;

  if (!content || content.length > 500) {
    return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
  }

  const anonId = generateAnonId();
  const result = await query(
    `INSERT INTO posts (anon_id, content, category) VALUES ($1, $2, $3) RETURNING *`,
    [anonId, content, category]
  );

  return NextResponse.json({ post: result.rows[0] }, { status: 201 });
}
