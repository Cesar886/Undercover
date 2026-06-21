import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { hashVoterToken } from '@/lib/hash';
import { emitFeed } from '@/lib/events';
import { isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { applyTrustDelta, shouldApplyTrustForVote } from '@/lib/trust';
import { getVoterKey } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { PoolClient } from 'pg';
import type { Notification } from '@/types';

type VoteType = 'up' | 'down';

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

  const vt = (body as Record<string, unknown>).vote_type;
  if (vt !== 'up' && vt !== 'down' && vt !== null) {
    return NextResponse.json({ error: 'Tipo de voto inválido' }, { status: 400 });
  }
  const next: VoteType | null = vt;

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

  const { votes, postLikeNotif } = await withTransaction(async (client: PoolClient) => {
    const existing = await client.query<{ vote_type: VoteType }>(
      'SELECT vote_type FROM votes WHERE post_id = $1 AND voter_token = $2 FOR UPDATE',
      [postId, voterToken]
    );
    const prev: VoteType | null = existing.rows[0]?.vote_type ?? null;

    const authorRes = await client.query<{ anon_id: string }>(
      'SELECT anon_id FROM posts WHERE id = $1',
      [postId]
    );
    const postAuthor = authorRes.rows[0]?.anon_id ?? null;

    if (prev === next) {
      const res = await client.query(
        'SELECT upvotes, downvotes FROM posts WHERE id = $1',
        [postId]
      );
      return { votes: res.rows[0], postLikeNotif: null };
    }

    if (next === null) {
      await client.query('DELETE FROM votes WHERE post_id = $1 AND voter_token = $2', [postId, voterToken]);
    } else if (prev === null) {
      await client.query(
        'INSERT INTO votes (post_id, voter_token, vote_type) VALUES ($1, $2, $3)',
        [postId, voterToken, next]
      );
    } else {
      await client.query(
        'UPDATE votes SET vote_type = $3 WHERE post_id = $1 AND voter_token = $2',
        [postId, voterToken, next]
      );
    }

    const upDelta = (next === 'up' ? 1 : 0) - (prev === 'up' ? 1 : 0);
    const downDelta = (next === 'down' ? 1 : 0) - (prev === 'down' ? 1 : 0);

    const res = await client.query(
      'UPDATE posts SET upvotes = upvotes + $2, downvotes = downvotes + $3 WHERE id = $1 RETURNING upvotes, downvotes',
      [postId, upDelta, downDelta]
    );

    if (postAuthor && shouldApplyTrustForVote(voterUsername, postAuthor)) {
      const trustDelta = upDelta * 2 + downDelta * -2;
      if (trustDelta !== 0) await applyTrustDelta(postAuthor, trustDelta, client);
    }

    let postLikeNotif: Notification | null = null;
    if (next === 'up' && prev !== 'up' && postAuthor) {
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

      postLikeNotif = await createNotification(postAuthor, 'post_like', postId, null, voterUsername, client);
    }

    return { votes: res.rows[0], postLikeNotif };
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
