import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const raw = (await cookies()).get('session_user')?.value;
    if (!raw) return NextResponse.json({ user: null });

    const parsedCookie = JSON.parse(raw);
    const { username } = parsedCookie;

    // Fetch trust data from DB
    const result = await query(
      `SELECT trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count
       FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      // User not found in DB — graceful degradation
      return NextResponse.json({ user: parsedCookie });
    }

    let { trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count } = result.rows[0];

    // Reset expired suspension
    if (is_suspended && suspension_end !== null && new Date(suspension_end) < new Date()) {
      await query(
        `UPDATE users
         SET trust_score = 0,
             is_suspended = false,
             trust_unlocked = false,
             suspension_count = suspension_count + 1
         WHERE username = $1`,
        [username]
      );

      trust_score = 0;
      is_suspended = false;
      trust_unlocked = false;
      suspension_count = (suspension_count ?? 0) + 1;
    }

    return NextResponse.json({
      user: {
        ...parsedCookie,
        trust_score,
        trust_unlocked,
        is_suspended,
        suspension_end,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
