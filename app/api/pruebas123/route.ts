import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAnonId } from '@/lib/anon';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { sanitize } from '@/lib/sanitize';
import { createPruebas123Memory, listPruebas123Memory } from '@/lib/pruebas123Memory';
import { badgeTriggeredBy } from '@/lib/feedVerification';
import { setTestIdentity, testAlias, testIdentity } from '@/lib/pruebas123Identity';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, private' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
let ready: Promise<void> | null = null;
function schema() {
  return ready ??= query(`
    CREATE TABLE IF NOT EXISTS pruebas123_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE pruebas123_entries ADD COLUMN IF NOT EXISTS thread_id UUID;
    ALTER TABLE pruebas123_entries ADD COLUMN IF NOT EXISTS alias TEXT;
    ALTER TABLE pruebas123_entries ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE pruebas123_entries ADD COLUMN IF NOT EXISTS badge_type TEXT CHECK (badge_type IN ('trophy', 'sparkle', 'aura'));
    ALTER TABLE pruebas123_entries DROP CONSTRAINT IF EXISTS pruebas123_entries_badge_type_check;
    ALTER TABLE pruebas123_entries ADD CONSTRAINT pruebas123_entries_badge_type_check CHECK (badge_type IN ('trophy', 'sparkle', 'aura'));
    CREATE INDEX IF NOT EXISTS pruebas123_entries_created_idx ON pruebas123_entries(created_at DESC, id DESC);
  `).then(() => {}).catch(error => { ready = null; throw error; });
}
export async function GET(request: NextRequest) {
  try {
    const identity = testIdentity(request);
    let entries;
    if (process.env.NODE_ENV === 'development') entries = listPruebas123Memory();
    else {
      await schema();
      entries = (await query(`SELECT id, content, created_at, thread_id, alias, verified, badge_type
        FROM pruebas123_entries ORDER BY created_at DESC, id DESC`)).rows;
    }
    return setTestIdentity(json({ entries, verified: identity.verified, badge: identity.badge }), identity);
  } catch {
    return json({ error: 'No se pudo cargar este espacio.' }, 500);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { anonId } = getAnonId(request);
    const rate = checkRateLimit('pruebas123:' + anonId, { windowMs: 3600000, max: 40 });
    if (!rate.ok) {
      const response = json({ error: 'Espera antes de volver a intentarlo.' }, 429);
      response.headers.set('Retry-After', String(rate.retryAfter));
      return response;
    }
    let input;
    try { input = await request.json(); } catch { return json({ error: 'Solicitud inválida.' }, 400); }
    if (!input || typeof input !== 'object') return json({ error: 'Solicitud inválida.' }, 400);
    let identity = testIdentity(request);
    if (input.action === 'reset') {
      identity = { id: randomUUID(), verified: false, badge: null };
      return setTestIdentity(json({ verified: false, badge: null }), identity);
    }
    const content = sanitize(typeof input.content === 'string' ? input.content : '');
    if (!content || content.length > 500) return json({ error: 'Escribe entre 1 y 500 caracteres.' }, 400);
    const thread = input.thread_id ?? null;
    if (thread !== null && (typeof thread !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(thread))) return json({ error: 'Hilo inválido.' }, 400);
    const triggeredBadge = badgeTriggeredBy(content);
    if (triggeredBadge) identity = { ...identity, verified: true, badge: triggeredBadge };
    const id = randomUUID();
    const alias = testAlias(identity, thread ?? id);
    let entry;
    if (process.env.NODE_ENV === 'development') {
      if (thread && !listPruebas123Memory().some(e => e.id === thread && !e.thread_id)) return json({ error: 'Hilo no encontrado.' }, 404);
      entry = createPruebas123Memory(content, { id, thread_id: thread, alias, verified: identity.verified, badge_type: identity.badge });
    } else {
      await schema();
      if (thread && !(await query('SELECT id FROM pruebas123_entries WHERE id = $1 AND thread_id IS NULL', [thread])).rows.length) return json({ error: 'Hilo no encontrado.' }, 404);
      entry = (await query(`INSERT INTO pruebas123_entries (content, id, thread_id, alias, verified, badge_type)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, content, created_at, thread_id, alias, verified, badge_type`,
      [content, id, thread, alias, identity.verified, identity.badge])).rows[0];
    }
    return setTestIdentity(json({ entry }, 201), identity);
  } catch {
    return json({ error: 'No se pudo guardar. Intenta de nuevo.' }, 500);
  }
}
