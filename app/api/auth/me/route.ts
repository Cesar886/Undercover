import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null });

    const { username } = session;

    const trustData = await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count
         FROM users WHERE username = $1 FOR UPDATE`,
        [username]
      );
      if (r.rows.length === 0) return null;

      let { trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count } = r.rows[0];

      if (is_suspended && suspension_end !== null && new Date(suspension_end) < new Date()) {
        await client.query(
          `UPDATE users SET trust_score = 0, is_suspended = false,
               trust_unlocked = false, suspension_count = suspension_count + 1
           WHERE username = $1`,
          [username]
        );
        trust_score = 0; is_suspended = false; trust_unlocked = false;
        suspension_end = null;
        suspension_count = (suspension_count ?? 0) + 1;
      }

      return {
        trust_score,
        trust_unlocked,
        is_suspended,
        suspension_end: suspension_end ? new Date(suspension_end).toISOString() : null,
      };
    });

    if (trustData === null) {
      return NextResponse.json({ user: session });
    }

    return NextResponse.json({ user: { ...session, ...trustData } });
  } catch (err) {
    console.error('[GET /api/auth/me]', err);
    return NextResponse.json({ user: null });
  }
}
