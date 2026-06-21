import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { hashVoterToken } from '@/lib/hash';
import { isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { applyTrustDelta, shouldApplyTrustForVote } from '@/lib/trust';
import { getVoterKey } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { emitFeed } from '@/lib/events';
import { PoolClient } from 'pg';
import type { Notification } from '@/types';

type VoteType = 'up' | 'down';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  if (!isUuid(params.id) || !isUuid(params.commentId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { key: voterKey } = await getVoterKey(request);
  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(voterKey, params.commentId, salt);

  const result = await query(
    'SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND voter_token = $2',
    [params.commentId, voterToken]
  );

  return NextResponse.json({ voted: result.rows[0]?.vote_type ?? null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  if (!isUuid(params.id) || !isUuid(params.commentId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

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

  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(voterKey, params.commentId, salt);

  let votes: { upvotes: number; downvotes: number };
  let commentLikeNotif: Notification | null = null;
  try {
    ({ votes, commentLikeNotif } = await withTransaction(async (client: PoolClient) => {
      const existing = await client.query<{ vote_type: VoteType }>(
        'SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND voter_token = $2 FOR UPDATE',
        [params.commentId, voterToken]
      );
      const prev: VoteType | null = existing.rows[0]?.vote_type ?? null;

      const authorRes = await client.query<{ anon_id: string }>(
        'SELECT anon_id FROM comments WHERE id = $1 AND post_id = $2',
        [params.commentId, params.id]
      );
      if (authorRes.rows.length === 0) {
        throw Object.assign(new Error('Comentario no encontrado'), { status: 404 });
      }
      const commentAuthor = authorRes.rows[0].anon_id;

      if (prev === next) {
        const res = await client.query(
          'SELECT upvotes, downvotes FROM comments WHERE id = $1',
          [params.commentId]
        );
        return {
          votes: { upvotes: res.rows[0].upvotes, downvotes: res.rows[0].downvotes },
          commentLikeNotif: null,
        };
      }

      if (next === null) {
        await client.query(
          'DELETE FROM comment_votes WHERE comment_id = $1 AND voter_token = $2',
          [params.commentId, voterToken]
        );
      } else if (prev === null) {
        await client.query(
          'INSERT INTO comment_votes (comment_id, voter_token, vote_type) VALUES ($1, $2, $3)',
          [params.commentId, voterToken, next]
        );
      } else {
        await client.query(
          'UPDATE comment_votes SET vote_type = $3 WHERE comment_id = $1 AND voter_token = $2',
          [params.commentId, voterToken, next]
        );
      }

      const upDelta = (next === 'up' ? 1 : 0) - (prev === 'up' ? 1 : 0);
      const downDelta = (next === 'down' ? 1 : 0) - (prev === 'down' ? 1 : 0);

      const res = await client.query(
        'UPDATE comments SET upvotes = upvotes + $2, downvotes = downvotes + $3 WHERE id = $1 RETURNING upvotes, downvotes',
        [params.commentId, upDelta, downDelta]
      );

      if (shouldApplyTrustForVote(voterUsername, commentAuthor)) {
        const trustDelta = upDelta * 2 + downDelta * -2;
        if (trustDelta !== 0) await applyTrustDelta(commentAuthor, trustDelta, client);
      }

      const notif = next === 'up' && prev !== 'up'
        ? await createNotification(commentAuthor, 'comment_like', params.id, params.commentId, voterUsername, client)
        : null;

      return {
        votes: { upvotes: res.rows[0].upvotes, downvotes: res.rows[0].downvotes },
        commentLikeNotif: notif,
      };
    }));
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = e.status ?? 500;
    return NextResponse.json({ error: e.message }, { status });
  }

  if (commentLikeNotif) {
    emitFeed({ type: 'notification:new', recipient: commentLikeNotif.recipient_username, notification: commentLikeNotif });
  }

  return NextResponse.json({ votes });
}
