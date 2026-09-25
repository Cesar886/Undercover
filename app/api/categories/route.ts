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
      `WITH visible_posts AS (
         SELECT id, category, created_at, last_bumped_at
         FROM posts
         WHERE is_hidden = false AND archived = false
       ),
       visible_comments AS (
         SELECT cm.id, cm.post_id, vp.category, cm.created_at
         FROM comments cm
         JOIN visible_posts vp ON vp.id = cm.post_id
         WHERE cm.is_hidden = false AND cm.is_deleted = false
       ),
       post_stats AS (
         SELECT category, COUNT(*)::int AS post_count, MAX(COALESCE(last_bumped_at, created_at)) AS last_post_at
         FROM visible_posts
         GROUP BY category
       ),
       comment_stats AS (
         SELECT category, COUNT(*)::int AS comment_count, MAX(created_at) AS last_comment_at
         FROM visible_comments
         GROUP BY category
       ),
       vote_stats AS (
         SELECT vp.category, COUNT(*)::int AS vote_count
         FROM votes v
         JOIN visible_posts vp ON vp.id = v.post_id
         GROUP BY vp.category
       ),
       post_reaction_stats AS (
         SELECT vp.category, COUNT(*)::int AS reaction_count
         FROM post_reactions pr
         JOIN visible_posts vp ON vp.id = pr.post_id
         GROUP BY vp.category
       ),
       comment_reaction_stats AS (
         SELECT vc.category, COUNT(*)::int AS reaction_count
         FROM comment_reactions cr
         JOIN visible_comments vc ON vc.id = cr.comment_id
         GROUP BY vc.category
       ),
       category_stats AS (
         SELECT
           c.slug,
           COALESCE(ps.post_count, 0)::int AS post_count,
           COALESCE(cs.comment_count, 0)::int AS comment_count,
           COALESCE(vs.vote_count, 0)::int AS vote_count,
           (COALESCE(prs.reaction_count, 0) + COALESCE(crs.reaction_count, 0))::int AS reaction_count,
           GREATEST(
             COALESCE(ps.last_post_at, c.created_at),
             COALESCE(cs.last_comment_at, c.created_at),
             c.created_at
           ) AS last_activity_at
         FROM categories c
         LEFT JOIN post_stats ps ON ps.category = c.slug
         LEFT JOIN comment_stats cs ON cs.category = c.slug
         LEFT JOIN vote_stats vs ON vs.category = c.slug
         LEFT JOIN post_reaction_stats prs ON prs.category = c.slug
         LEFT JOIN comment_reaction_stats crs ON crs.category = c.slug
         WHERE c.slug <> ALL($1::text[])
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
