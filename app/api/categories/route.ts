import { NextRequest, NextResponse } from 'next/server';
import { getAnonId } from '@/lib/anon';
import { categorySlug, ensureCategoriesSchema, listCategories } from '@/lib/categories';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { sanitize } from '@/lib/sanitize';
import { isCategoryAvailable, RETIRED_CATEGORIES } from '@/lib/categoryAvailability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const paged = request.nextUrl.searchParams.get('paged') === 'true';
    if (!paged) {
      return NextResponse.json({ categories: await listCategories() }, { headers: { 'Cache-Control': 'no-store' } });
    }

    await ensureCategoriesSchema();
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const rawLimit = parseInt(request.nextUrl.searchParams.get('limit') || '12', 10);
    const limit = Math.min(24, Math.max(4, Number.isFinite(rawLimit) ? rawLimit : 12));
    const offset = (page - 1) * limit;
    const result = await query(
      `WITH category_stats AS (
         SELECT
           c.slug,
           COUNT(DISTINCT p.id)::int AS post_count,
           COUNT(DISTINCT cm.id)::int AS comment_count,
           COUNT(DISTINCT v.id)::int AS vote_count,
           (
             COUNT(DISTINCT pr.post_id::text || ':' || pr.voter_token)::int +
             COUNT(DISTINCT cr.comment_id::text || ':' || cr.voter_token)::int
           ) AS reaction_count,
           MAX(GREATEST(
             COALESCE(p.last_bumped_at, p.created_at, c.created_at),
             COALESCE(cm.created_at, p.created_at, c.created_at),
             c.created_at
           )) AS last_activity_at
         FROM categories c
         LEFT JOIN posts p
           ON p.category = c.slug
          AND p.is_hidden = false
          AND p.archived = false
         LEFT JOIN comments cm
           ON cm.post_id = p.id
          AND cm.is_hidden = false
          AND cm.is_deleted = false
         LEFT JOIN votes v ON v.post_id = p.id
         LEFT JOIN post_reactions pr ON pr.post_id = p.id
         LEFT JOIN comment_reactions cr ON cr.comment_id = cm.id
         WHERE c.slug <> ALL($1::text[])
         GROUP BY c.slug, c.created_at
       )
       SELECT
         c.slug, c.name, c.description, c.is_system, c.created_at,
         s.post_count, s.comment_count, s.vote_count, s.reaction_count, s.last_activity_at,
         (
           s.post_count * 8 +
           s.comment_count * 4 +
           s.vote_count * 2 +
           s.reaction_count +
           CASE WHEN s.last_activity_at > NOW() - INTERVAL '24 hours' THEN 60 ELSE 0 END +
           CASE WHEN s.last_activity_at > NOW() - INTERVAL '7 days' THEN 25 ELSE 0 END
         )::int AS activity_score
       FROM categories c
       JOIN category_stats s ON s.slug = c.slug
       WHERE c.slug <> ALL($1::text[])
       ORDER BY activity_score DESC, s.last_activity_at DESC NULLS LAST, c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [RETIRED_CATEGORIES, limit, offset]
    );
    return NextResponse.json(
      { categories: result.rows, page, limit, hasMore: result.rows.length === limit },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[GET /api/categories]', error);
    return NextResponse.json({ error: 'No se pudieron cargar las categorías' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let anonId: string;
  try {
    ({ anonId } = getAnonId(request));
  } catch {
    return NextResponse.json({ error: 'Error de identidad anónima' }, { status: 500 });
  }

  const rate = checkRateLimit(`categories:anon:${anonId}`, { windowMs: 24 * 60 * 60 * 1000, max: 3 });
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Puedes crear máximo 3 categorías por día' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = sanitize(typeof body.name === 'string' ? body.name : '').trim();
  const description = sanitize(typeof body.description === 'string' ? body.description : '').trim();
  const slug = categorySlug(name);
  if (!isCategoryAvailable(slug)) {
    return NextResponse.json({ error: 'Esta categoría ya no está disponible' }, { status: 400 });
  }

  if (name.length < 3 || name.length > 40) {
    return NextResponse.json({ error: 'El nombre debe tener entre 3 y 40 caracteres' }, { status: 400 });
  }
  if (!slug || slug.length < 3) {
    return NextResponse.json({ error: 'Usa un nombre con al menos 3 letras o números' }, { status: 400 });
  }
  if (description.length > 120) {
    return NextResponse.json({ error: 'La descripción permite máximo 120 caracteres' }, { status: 400 });
  }

  try {
    await ensureCategoriesSchema();
    const result = await query(
      `INSERT INTO categories (slug, name, description, creator_anon_id)
       VALUES ($1, $2, $3, $4)
       RETURNING slug, name, description, is_system, created_at`,
      [slug, name, description, anonId]
    );
    const response = NextResponse.json({ category: result.rows[0] }, { status: 201 });
    return response;
  } catch (error: unknown) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 });
    }
    console.error('[POST /api/categories]', error);
    return NextResponse.json({ error: 'No se pudo crear la categoría' }, { status: 500 });
  }
}
