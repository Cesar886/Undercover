import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { applyBan, liftBan } from '@/lib/ipban';

function authorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get('x-admin-secret') === secret;
}

// GET /api/admin/ban — list active bans
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bans = await query(
    `SELECT ip, reason, expires_at, offense_count, created_at
     FROM ip_bans WHERE expires_at > NOW()
     ORDER BY created_at DESC LIMIT 100`
  );

  const flagged = await query(
    `SELECT id, content, report_count, created_at, poster_ip
     FROM posts WHERE report_count >= 5 AND is_hidden = FALSE
     ORDER BY report_count DESC LIMIT 50`
  );

  return NextResponse.json({ bans: bans.rows, flagged: flagged.rows });
}

// POST /api/admin/ban — manually ban an IP
// Body: { ip, reason?, hours? }
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.ip) return NextResponse.json({ error: 'ip requerido' }, { status: 400 });

  const reason = body.reason ?? 'ban manual';

  if (body.hours) {
    // Custom duration ban (not escalating)
    await query(
      `INSERT INTO ip_bans (ip, reason, expires_at, offense_count)
       VALUES ($1, $2, NOW() + ($3 || ' hours')::interval,
               (SELECT COUNT(*) + 1 FROM ip_bans WHERE ip = $1))`,
      [body.ip, reason, String(body.hours)]
    );
  } else {
    await applyBan(body.ip, reason);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/ban — lift active bans for an IP
// Body: { ip }
export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.ip) return NextResponse.json({ error: 'ip requerido' }, { status: 400 });

  await liftBan(body.ip);
  return NextResponse.json({ ok: true });
}
