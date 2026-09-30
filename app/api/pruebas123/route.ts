import { NextRequest, NextResponse } from 'next/server';
import { getAnonId } from '@/lib/anon';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { sanitize } from '@/lib/sanitize';
import { createPruebas123Memory, listPruebas123Memory } from '@/lib/pruebas123Memory';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, private' };

async function ensurePruebas123Table() {
  await query(`
    CREATE TABLE IF NOT EXISTS pruebas123_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS pruebas123_entries_created_idx
    ON pruebas123_entries (created_at DESC, id DESC)
  `);
}

export async function GET() {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({ entries: listPruebas123Memory() }, { headers: NO_STORE });
  }
  try {
    await ensurePruebas123Table();
    const result = await query(
      `SELECT id, content, created_at
       FROM pruebas123_entries
       ORDER BY created_at DESC, id DESC
       LIMIT 100`
    );
    return NextResponse.json({ entries: result.rows }, { headers: NO_STORE });
  } catch (error) {
    console.error('[GET /api/pruebas123]', error);
    return NextResponse.json(
      { error: 'No se pudo cargar este espacio.' },
      { status: 500, headers: NO_STORE }
    );
  }
}

export async function POST(request: NextRequest) {
  let anonId: string;
  try {
    ({ anonId } = getAnonId(request));
  } catch {
    return NextResponse.json(
      { error: 'No se pudo crear la identidad anonima.' },
      { status: 500, headers: NO_STORE }
    );
  }

  const rate = checkRateLimit(`pruebas123:${anonId}`, {
    windowMs: 60 * 60 * 1000,
    max: 40,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Vas muy rapido. Intenta de nuevo mas tarde.' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(rate.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400, headers: NO_STORE });
  }

  const rawContent = typeof body === 'object' && body !== null && 'content' in body
    ? (body as { content?: unknown }).content
    : '';
  const content = sanitize(typeof rawContent === 'string' ? rawContent : '');

  if (!content) {
    return NextResponse.json({ error: 'Escribe algo antes de publicar.' }, { status: 400, headers: NO_STORE });
  }
  if (content.length > 500) {
    return NextResponse.json({ error: 'El texto permite maximo 500 caracteres.' }, { status: 400, headers: NO_STORE });
  }

  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json(
      { entry: createPruebas123Memory(content) },
      { status: 201, headers: NO_STORE }
    );
  }

  try {
    await ensurePruebas123Table();
    const result = await query(
      `INSERT INTO pruebas123_entries (content)
       VALUES ($1)
       RETURNING id, content, created_at`,
      [content]
    );
    return NextResponse.json({ entry: result.rows[0] }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error('[POST /api/pruebas123]', error);
    return NextResponse.json(
      { error: 'No se pudo guardar el texto.' },
      { status: 500, headers: NO_STORE }
    );
  }
}
