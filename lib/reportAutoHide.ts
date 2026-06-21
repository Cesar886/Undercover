import type { PoolClient } from 'pg';

type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'misinformation' | 'other' | string;

type PostRow = {
  id: string;
  anon_id: string | null;
  created_at: Date | string;
  is_hidden: boolean;
};

type ReportRow = {
  reporter_id: string;
  reason: ReportReason;
  created_at: Date | string;
  trust_score: number | null;
  ignored_reports_24h: number;
};

type ValidReport = ReportRow & {
  weight: number;
};

type PostColumns = {
  hiddenColumn: 'hidden' | 'is_hidden';
  hasHideReason: boolean;
  hasHiddenAt: boolean;
};

const BRIGADING_REPORTER_COUNT = 5;
const BRIGADING_WINDOW_MINUTES = 2;
const BRIGADING_PAUSE_MINUTES = 15;

function getTrustWeight(trustScore: number): number {
  if (trustScore >= 3) return 2;
  if (trustScore >= 1) return 1;
  if (trustScore >= -1) return 0.5;
  if (trustScore >= -3) return 0.25;
  return 0;
}

function getBaseThreshold(createdAt: Date): number {
  const ageMs = Date.now() - createdAt.getTime();
  const ageHours = ageMs / 3_600_000;

  if (ageHours < 1) return 3;
  if (ageHours < 6) return 5;
  if (ageHours < 24) return 8;
  return 12;
}

function getReplyThresholdBonus(replyCount: number): number {
  if (replyCount > 100) return 6;
  if (replyCount > 50) return 4;
  if (replyCount > 10) return 2;
  return 0;
}

function mostReportedReason(reports: ValidReport[]): ReportReason | null {
  const counts = new Map<ReportReason, number>();
  for (const report of reports) {
    counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
  }

  let topReason: ReportReason | null = null;
  let topCount = 0;
  for (const [reason, count] of counts) {
    if (count > topCount) {
      topReason = reason;
      topCount = count;
    }
  }

  return topReason;
}

async function ensureReportEvaluationState(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS post_report_evaluation_state (
      post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
      paused_until TIMESTAMPTZ
    )
  `);
}

async function getPostColumns(client: PoolClient): Promise<PostColumns> {
  const res = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'posts'
       AND column_name IN ('hidden', 'is_hidden', 'hide_reason', 'hidden_at')`
  );
  const columns = new Set(res.rows.map((row) => row.column_name));

  return {
    hiddenColumn: columns.has('hidden') ? 'hidden' : 'is_hidden',
    hasHideReason: columns.has('hide_reason'),
    hasHiddenAt: columns.has('hidden_at'),
  };
}

async function adjustTrust(
  client: PoolClient,
  anonIds: string[],
  delta: number
): Promise<void> {
  const uniqueAnonIds = Array.from(new Set(anonIds.filter(Boolean)));
  if (uniqueAnonIds.length === 0) return;

  await client.query(
    `UPDATE users
     SET trust_score = GREATEST(-5, LEAST(5, trust_score + $2))
     WHERE username = ANY($1::text[])`,
    [uniqueAnonIds, delta]
  );
}

function normalizeReporterId(reporterId: string): string {
  return reporterId.startsWith('user:') ? reporterId.slice('user:'.length) : reporterId;
}

export async function evaluatePostAutoHideAfterReport(
  client: PoolClient,
  postId: string,
  reporterAnonId: string
): Promise<boolean> {
  await ensureReportEvaluationState(client);
  const postColumns = await getPostColumns(client);

  const postRes = await client.query<PostRow>(
    `SELECT p.id,
            p.anon_id,
            p.created_at,
            p.${postColumns.hiddenColumn} AS is_hidden
     FROM posts p
     WHERE p.id = $1
     FOR UPDATE OF p`,
    [postId]
  );

  const post = postRes.rows[0];
  if (!post || post.is_hidden) return false;

  const duplicateRes = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM reports
     WHERE target_type = 'post'
       AND target_id = $1
       AND reporter_id = $2`,
    [postId, reporterAnonId]
  );

  if (Number(duplicateRes.rows[0]?.count ?? 0) > 1) {
    return false;
  }

  const stateRes = await client.query<{ paused_until: Date | string | null }>(
    `SELECT paused_until
     FROM post_report_evaluation_state
     WHERE post_id = $1`,
    [postId]
  );
  const pausedUntil = stateRes.rows[0]?.paused_until ?? null;

  if (pausedUntil && new Date(pausedUntil) > new Date()) {
    return false;
  }

  const brigadeRes = await client.query<{ reporter_count: string }>(
    `SELECT COUNT(DISTINCT reporter_id)::text AS reporter_count
     FROM reports
     WHERE target_type = 'post'
       AND target_id = $1
       AND created_at >= NOW() - ($2 || ' minutes')::interval`,
    [postId, String(BRIGADING_WINDOW_MINUTES)]
  );

  if (Number(brigadeRes.rows[0]?.reporter_count ?? 0) >= BRIGADING_REPORTER_COUNT) {
    await client.query(
      `INSERT INTO post_report_evaluation_state (post_id, paused_until)
       VALUES ($1, NOW() + ($2 || ' minutes')::interval)
       ON CONFLICT (post_id)
       DO UPDATE SET paused_until = EXCLUDED.paused_until`,
      [postId, String(BRIGADING_PAUSE_MINUTES)]
    );
    return false;
  }

  const reportsRes = await client.query<ReportRow>(
    `WITH unique_reports AS (
       SELECT DISTINCT ON (r.reporter_id)
              r.reporter_id,
              r.reason,
              r.created_at
       FROM reports r
       WHERE r.target_type = 'post'
         AND r.target_id = $1
       ORDER BY r.reporter_id, r.created_at ASC
     ),
     ignored_reports AS (
       SELECT r.reporter_id, COUNT(*)::int AS ignored_reports_24h
       FROM reports r
       JOIN posts p
         ON p.id = r.target_id
        AND r.target_type = 'post'
       WHERE r.created_at >= NOW() - INTERVAL '24 hours'
         AND r.created_at < NOW() - INTERVAL '15 minutes'
         AND p.${postColumns.hiddenColumn} = false
       GROUP BY r.reporter_id
     )
     SELECT ur.reporter_id,
            ur.reason,
            ur.created_at,
            u.trust_score,
            COALESCE(ir.ignored_reports_24h, 0)::int AS ignored_reports_24h
     FROM unique_reports ur
     LEFT JOIN users u
       ON u.username = regexp_replace(ur.reporter_id, '^user:', '')
     LEFT JOIN ignored_reports ir
       ON ir.reporter_id = ur.reporter_id
     ORDER BY ur.created_at ASC`,
    [postId]
  );

  const validReports = reportsRes.rows
    .map((report) => {
      const abuseFrozen = report.ignored_reports_24h >= 5;
      const trustScore = report.trust_score ?? 0;
      const weight = abuseFrozen ? 0 : getTrustWeight(trustScore);
      return { ...report, weight };
    })
    .filter((report): report is ValidReport => report.weight > 0);

  const commentCountRes = await client.query<{ comment_count: number }>(
    `SELECT COUNT(*)::int AS comment_count
     FROM comments
     WHERE post_id = $1
       AND is_hidden = false
       AND is_deleted = false`,
    [postId]
  );
  const commentCount = commentCountRes.rows[0]?.comment_count ?? 0;

  const weightedReportTotal = validReports.reduce((sum, report) => sum + report.weight, 0);
  const threshold = getBaseThreshold(new Date(post.created_at)) + getReplyThresholdBonus(commentCount);
  const validReporterIds = validReports.map((report) => normalizeReporterId(report.reporter_id));

  if (weightedReportTotal >= threshold) {
    const setClauses = [`${postColumns.hiddenColumn} = true`];
    const values: unknown[] = [postId];

    if (postColumns.hasHideReason) {
      values.push(mostReportedReason(validReports));
      setClauses.push(`hide_reason = $${values.length}`);
    }
    if (postColumns.hasHiddenAt) {
      setClauses.push('hidden_at = NOW()');
    }

    await client.query(
      `UPDATE posts
       SET ${setClauses.join(', ')}
       WHERE id = $1
         AND ${postColumns.hiddenColumn} = false`,
      values
    );

    if (post.anon_id) {
      await adjustTrust(client, [post.anon_id], -2);
    }
    await adjustTrust(client, validReporterIds, 1);

    await client.query(
      `DELETE FROM post_report_evaluation_state WHERE post_id = $1`,
      [postId]
    );

    return true;
  }

  await adjustTrust(client, validReporterIds, -1);
  return false;
}
