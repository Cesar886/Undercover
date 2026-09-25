import { NextRequest, NextResponse } from 'next/server';
import { getAnonId } from '@/lib/anon';
import { categorySlug, ensureCategoriesSchema, listCategories } from '@/lib/categories';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { sanitize } from '@/lib/sanitize';
import { isCategoryAvailable } from '@/lib/categoryAvailability';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ categories: await listCategories() }, { headers: { 'Cache-Control': 'no-store' } });
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
