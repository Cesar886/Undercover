import type { NextRequest } from 'next/server';
import { query } from './db';

// Escalation: 1st → 24h, 2nd → 7d, 3rd → 30d, 4th+ → 90d (never permanent)
const BAN_HOURS = [24, 168, 720, 2160];

export function getRealIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '0.0.0.0'
  );
}

export async function getBanStatus(
  ip: string
): Promise<{ banned: false } | { banned: true; expiresAt: Date; offenseCount: number }> {
  const res = await query(
    `SELECT expires_at, offense_count FROM ip_bans
     WHERE ip = $1 AND expires_at > NOW()
     ORDER BY expires_at DESC LIMIT 1`,
    [ip]
  );
  if (res.rows.length === 0) return { banned: false };
  return {
    banned: true,
    expiresAt: new Date(res.rows[0].expires_at),
    offenseCount: res.rows[0].offense_count,
  };
}

export async function applyBan(ip: string, reason: string): Promise<void> {
  const prev = await query(
    `SELECT COUNT(*)::int AS n FROM ip_bans WHERE ip = $1`,
    [ip]
  );
  const offense = (prev.rows[0].n as number) + 1;
  const hours   = BAN_HOURS[Math.min(offense - 1, BAN_HOURS.length - 1)];

  await query(
    `INSERT INTO ip_bans (ip, reason, expires_at, offense_count)
     VALUES ($1, $2, NOW() + ($3 || ' hours')::interval, $4)`,
    [ip, reason, String(hours), offense]
  );
}

export async function liftBan(ip: string): Promise<void> {
  await query(
    `UPDATE ip_bans SET expires_at = NOW() WHERE ip = $1 AND expires_at > NOW()`,
    [ip]
  );
}

export function banMessage(expiresAt: Date): string {
  const diffMs  = expiresAt.getTime() - Date.now();
  const hours   = Math.ceil(diffMs / 3_600_000);
  const days    = Math.floor(hours / 24);
  const display = days >= 1 ? `${days} día${days > 1 ? 's' : ''}` : `${hours} hora${hours > 1 ? 's' : ''}`;
  return `Estás baneado temporalmente. Podrás publicar en ${display}.`;
}
