import { PoolClient } from 'pg';

/**
 * Applies a trust score delta to a user within an existing transaction.
 * Uses FOR UPDATE to lock the row and handles suspension escalation logic.
 */
export async function applyTrustDelta(
  username: string,
  baseDelta: number,
  client: PoolClient
): Promise<void> {
  const res = await client.query<{
    trust_score: number;
    trust_unlocked: boolean;
    is_suspended: boolean;
    suspension_end: Date | null;
    suspension_count: number;
  }>(
    `SELECT trust_score, trust_unlocked, is_suspended, suspension_end, suspension_count
     FROM users
     WHERE username = $1
     FOR UPDATE`,
    [username]
  );

  if (res.rows.length === 0) return;

  const {
    trust_score,
    trust_unlocked,
    is_suspended,
    suspension_end,
    suspension_count,
  } = res.rows[0];

  // Step 3: calculate adjusted delta
  let delta: number;
  if (baseDelta > 0 && trust_score < 10) {
    delta = Math.floor(baseDelta / 2);
  } else if (baseDelta < 0 && trust_score < 0) {
    delta = Math.ceil(baseDelta * 1.5);
  } else {
    delta = baseDelta;
  }

  const newScore = trust_score + delta;
  const shouldUnlock = newScore >= 10 && !trust_unlocked;

  // Step 6: calculate suspension state
  let newIsSuspended = is_suspended;
  let newSuspensionEnd: Date | null = suspension_end;

  if (newScore < 0) {
    const suspensionIsActive = is_suspended && (suspension_end === null || suspension_end > new Date());
    if (!suspensionIsActive) {
      // User is not currently suspended — apply new suspension
      if (suspension_count >= 1) {
        // Second offence or more → permanent
        newIsSuspended = true;
        newSuspensionEnd = null;
      } else if (newScore <= -11) {
        // Severe score → 7 days
        newIsSuspended = true;
        newSuspensionEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      } else {
        // Mild → 24 hours
        newIsSuspended = true;
        newSuspensionEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    } else if (suspensionIsActive && suspension_end !== null) {
      // User is already suspended with a finite end — consider escalation
      if (suspension_count >= 1) {
        // Promote to permanent
        newSuspensionEnd = null;
      } else if (newScore <= -11) {
        const candidate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (candidate > suspension_end) {
          newSuspensionEnd = candidate;
        }
        // If current suspension_end is already 7+ days away, leave it alone
      }
      // If neither condition matched, don't touch suspension_end
    }
    // If is_suspended && suspension_end === null (already permanent), nothing to do
  }

  // Step 7: UPDATE
  await client.query(
    `UPDATE users
     SET trust_score     = $1,
         trust_unlocked  = CASE WHEN $2 THEN true ELSE trust_unlocked END,
         is_suspended    = $3,
         suspension_end  = $4
     WHERE username = $5`,
    [newScore, shouldUnlock, newIsSuspended, newSuspensionEnd, username]
  );
}

/**
 * Returns whether a trust delta should be applied for a vote action.
 * Anonymous voters (null) always count. Self-votes never count.
 */
export function shouldApplyTrustForVote(
  voterUsername: string | null,
  authorUsername: string
): boolean {
  if (voterUsername === null) return true;
  if (voterUsername === authorUsername) return false;
  return true;
}

/**
 * Formats a suspension end date as DD/MM/YYYY HH:mm in the user's local timezone.
 */
export function formatSuspensionDate(date: Date | string): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
