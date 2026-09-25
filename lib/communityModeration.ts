import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from './db';
import { getAnonId } from './anon';
import { emitFeed } from './events';
import { isUuid, validateReportInput } from './validation';

// A fixed quorum cannot become unreachable as a post ages. Each browser
// identifier counts once; pending reports never penalize the reporter.
export const REPORT_QUORUM = 5;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS community_sanctions (
 anon_id TEXT PRIMARY KEY,
 hidden_count INT NOT NULL DEFAULT 0,
 suspended_until TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS community_reports (
 target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
 target_id UUID NOT NULL,
 reporter_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 detail TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (target_type, target_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS community_reports_rate_idx ON community_reports (reporter_id, created_at);
-- Stop recording network identifiers without deleting historical report data.
-- NULL values do not conflict with the legacy unique network constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_reports'
      AND column_name = 'network_key'
  ) THEN
    ALTER TABLE public.community_reports ALTER COLUMN network_key DROP NOT NULL;
    ALTER TABLE public.community_reports ALTER COLUMN network_key DROP DEFAULT;
  END IF;
END $$;

`;
let ready: Promise<void> | undefined;
export function ensureCommunitySchema() {
  if (!ready) ready = query(SCHEMA).then(() => {}).catch(error => { ready = undefined; throw error; });
  return ready;
}

export function sanctionHours(count: number): number {
  if (count >= 10) return 168;
  if (count >= 5) return 24;
  if (count >= 3) return 1;
  return 0;
}

export async function communitySuspension(anonId: string): Promise<NextResponse | null> {
  await ensureCommunitySchema();
  const result = await query(
    'SELECT suspended_until FROM community_sanctions WHERE anon_id = $1 AND suspended_until > NOW()', [anonId]
  );
  if (!result.rows.length) return null;
  return NextResponse.json({
    error: 'Tu identidad está suspendida temporalmente por reportes de la comunidad.',
    suspended_until: result.rows[0].suspended_until,
  }, { status: 403 });
}

export async function reportContent(request: NextRequest, postId: string, commentId?: string) {
  if (!isUuid(postId) || (commentId !== undefined && !isUuid(commentId))) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const input = validateReportInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: input.status });

  try {
    const { anonId } = getAnonId(request);
    await ensureCommunitySchema();
    const suspended = await communitySuspension(anonId);
    if (suspended) return suspended;
    const kind = commentId ? 'comment' : 'post';
    const table = commentId ? 'comments' : 'posts';
    const targetId = commentId ?? postId;
    const outcome = await withTransaction(async client => {
      // Serialize the hourly quota across targets, processes and restarts.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [anonId]);
      if (commentId) {
        const parent = await client.query('SELECT id FROM posts WHERE id = $1 AND is_hidden = false FOR SHARE', [postId]);
        if (!parent.rows.length) return { status: 404, error: 'Post no encontrado' };
      }
      const target = await client.query(
        `SELECT anon_id, is_hidden FROM ${table} WHERE id = $1${commentId ? ' AND post_id = $2 AND is_deleted = false' : ''} FOR UPDATE`,
        commentId ? [targetId, postId] : [targetId]
      );
      if (!target.rows.length || target.rows[0].is_hidden) return { status: 404, error: 'Contenido no encontrado' };
      if (target.rows[0].anon_id === anonId) return { status: 403, error: 'No puedes reportar tu propio contenido' };
      const duplicate = await client.query(
        `SELECT 1 FROM community_reports WHERE target_type = $1 AND target_id = $2 AND reporter_id = $3`,
        [kind, targetId, anonId]
      );
      if (duplicate.rows.length) return { status: 409, error: 'Ya se registró un reporte de esta identidad' };
      const quota = await client.query(
        `SELECT COUNT(*)::int AS identity_count
         FROM community_reports WHERE created_at > NOW() - INTERVAL '1 hour'
           AND reporter_id = $1`, [anonId]
      );
      if (quota.rows[0].identity_count >= 10) return { status: 429, error: 'Máximo 10 reportes por hora por identidad. Intenta más tarde.' };
      await client.query(
        `INSERT INTO community_reports (target_type, target_id, reporter_id, reason, detail) VALUES ($1, $2, $3, $4, $5)`,
        [kind, targetId, anonId, input.value.reason, input.value.detail ?? null]
      );
      const updated = await client.query(
        `UPDATE ${table} SET report_count = (SELECT COUNT(*)::int FROM community_reports WHERE target_type = $1 AND target_id = $2),
         is_hidden = (SELECT COUNT(*) >= $3 FROM community_reports WHERE target_type = $1 AND target_id = $2)
         WHERE id = $2 RETURNING report_count, is_hidden`, [kind, targetId, REPORT_QUORUM]
      );
      const result = updated.rows[0];
      if (result.is_hidden) {
        // Only the transition to hidden records a strike; the locked target
        // rejects every later report. Counters survive post deletion/pruning.
        const strike = await client.query(
          `INSERT INTO community_sanctions (anon_id, hidden_count) VALUES ($1, 1)
           ON CONFLICT (anon_id) DO UPDATE SET hidden_count = community_sanctions.hidden_count + 1
           RETURNING hidden_count`, [target.rows[0].anon_id]
        );
        const hours = sanctionHours(strike.rows[0].hidden_count);
        if (hours) await client.query(
          `UPDATE community_sanctions SET suspended_until = GREATEST(suspended_until, NOW() + $2 * INTERVAL '1 hour') WHERE anon_id = $1`,
          [target.rows[0].anon_id, hours]
        );
      }
      return { status: 200, ...result };
    });
    if (outcome.status === 200 && outcome.is_hidden) {
      if (commentId) emitFeed({ type: 'comment:deleted', postId, commentId, soft: false });
      else emitFeed({ type: 'post:hidden', postId });
    }
    const response = NextResponse.json(outcome.status === 200 ? { success: true, report_count: outcome.report_count, is_hidden: outcome.is_hidden } : { error: outcome.error },
      { status: outcome.status, ...(outcome.status === 429 ? { headers: { 'Retry-After': '3600' } } : {}) });
    return response;
  } catch (error) {
    console.error('Community report failed:', error);
    return NextResponse.json({ error: 'No se pudo guardar el reporte. Intenta de nuevo.' }, { status: 500 });
  }
}
