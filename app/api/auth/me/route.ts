import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withTransaction } from '@/lib/db';

export async function GET() {
  try {
    const raw = (await cookies()).get('session_user')?.value;
    if (!raw) return NextResponse.json({ user: null });

    const parsedCookie = JSON.parse(raw);
    const { username } = parsedCookie;

    // Issue #2: Validate username before querying
    if (typeof username !== 'string' || !username) {
      return NextResponse.json({ user: null });
    }

    // Issue #1: Wrap in transaction with FOR UPDATE to avoid race condition
    const trustData = await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count
         FROM users WHERE username = $1 FOR UPDATE`,
        [username]
      );
      if (r.rows.length === 0) return null;

      let { trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count } = r.rows[0];

      // Reset expired suspension
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
        // Issue #4: Serialize suspension_end to ISO string
        suspension_end: suspension_end ? new Date(suspension_end).toISOString() : null,
      };
    });

    if (trustData === null) {
      // User not found in DB — graceful degradation
      return NextResponse.json({ user: parsedCookie });
    }

    return NextResponse.json({
      user: {
        ...parsedCookie,
        ...trustData,
      },
    });
  } catch (err) {
    // Issue #3: Log errors in catch
    console.error('[GET /api/auth/me]', err);
    return NextResponse.json({ user: null });
  }
}
