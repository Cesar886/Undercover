import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { hashVoterToken } from '@/lib/hash';
import { emitFeed } from '@/lib/events';
import { validateVoteInput, isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { applyTrustDelta, shouldApplyTrustForVote } from '@/lib/trust';
import { getVoterKey } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { PoolClient } from 'pg';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const { key: voterKey } = await getVoterKey(request);
  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(voterKey, params.id, salt);

  const result = await query(
    'SELECT vote_type FROM votes WHERE post_id = $1 AND voter_token = $2',
    [params.id, voterToken]
  );

  return NextResponse.json({ voted: result.rows[0]?.vote_type ?? null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validateVoteInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const { key: voterKey, username: voterUsername } = await getVoterKey(request);

  const rl = checkRateLimit(`votes:${voterKey}`, RATE_LIMITS.votes);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiados votos. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const postId = params.id;
  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(voterKey, postId, salt);

  const existingVote = await query(
    'SELECT id FROM votes WHERE post_id = $1 AND voter_token = $2',
    [postId, voterToken]
  );

  if (existingVote.rows.length > 0) {
    return NextResponse.json({ error: 'Ya votaste en este post' }, { status: 409 });
  }

  // col is safe: derived from validated enum 'up' | 'down', never from raw user input
  const col = v.value.vote_type === 'up' ? 'upvotes' : 'downvotes';
  const { votes, postLikeNotif } = await withTransaction(async (client: PoolClient) => {
    await client.query(
      'INSERT INTO votes (post_id, voter_token, vote_type) VALUES ($1, $2, $3)',
      [postId, voterToken, v.value.vote_type]
    );
    const res = await client.query(
      `UPDATE posts SET ${col} = ${col} + 1 WHERE id = $1 RETURNING upvotes, downvotes`,
      [postId]
    );

    const authorRes = await client.query<{ anon_id: string }>(
      'SELECT anon_id FROM posts WHERE id = $1',
      [postId]
    );
    const postAuthor = authorRes.rows[0]?.anon_id ?? null;

    if (postAuthor && shouldApplyTrustForVote(voterUsername, postAuthor)) {
      if (v.value.vote_type === 'up') {
        await applyTrustDelta(postAuthor, 2, client);
      } else {
        await applyTrustDelta(postAuthor, -2, client);
      }
    }

    if (v.value.vote_type === 'up' && postAuthor) {
      const milestoneRes = await client.query<{
        upvotes: number;
        downvotes: number;
        milestone_5_rewarded: boolean;
      }>(
        'SELECT upvotes, downvotes, milestone_5_rewarded FROM posts WHERE id = $1',
        [postId]
      );
      const post = milestoneRes.rows[0];
      if (post && post.upvotes - post.downvotes >= 5 && !post.milestone_5_rewarded) {
        await client.query(
          'UPDATE posts SET milestone_5_rewarded = true WHERE id = $1',
          [postId]
        );
        await applyTrustDelta(postAuthor, 10, client);
      }
    }

    const notif = v.value.vote_type === 'up' && postAuthor
      ? await createNotification(postAuthor, 'post_like', postId, null, voterUsername, client)
      : null;

    return { votes: res.rows[0], postLikeNotif: notif };
  });

  emitFeed({
    type: 'post:vote',
    postId,
    upvotes: votes.upvotes,
    downvotes: votes.downvotes,
  });

  if (postLikeNotif) {
    emitFeed({ type: 'notification:new', recipient: postLikeNotif.recipient_username, notification: postLikeNotif });
  }

  return NextResponse.json({ votes });
}
