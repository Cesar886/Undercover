import { PoolClient } from 'pg';
import { query } from './db';

type Queryable = Pick<PoolClient, 'query'>;

export const ADMIN_REPORT_STATUSES = ['pending', 'reviewed', 'dismissed'] as const;
export type AdminReportStatus = typeof ADMIN_REPORT_STATUSES[number];

export async function ensureAdminReportsSchema(client?: Queryable) {
  const run = client?.query.bind(client) ?? query;
  await run(`
    ALTER TABLE community_reports
      ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'reviewed', 'dismissed'))
  `);
  await run(`ALTER TABLE community_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
  await run(`CREATE INDEX IF NOT EXISTS community_reports_review_status_idx ON community_reports (review_status, created_at DESC)`);
  await run(`CREATE INDEX IF NOT EXISTS community_reports_target_created_idx ON community_reports (target_type, target_id, created_at DESC)`);
}

export function normalizeAdminReportStatus(value: string | null): AdminReportStatus | 'all' {
  if (value === 'all') return 'all';
  return ADMIN_REPORT_STATUSES.includes(value as AdminReportStatus) ? value as AdminReportStatus : 'pending';
}
