import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { hashVoterToken } from '@/lib/hash';
import { validateVoteInput, isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { applyTrustDelta, shouldApplyTrustForVote } from '@/lib/trust';
import { getVoterKey } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { emitFeed } from '@/lib/events';
import { PoolClient } from 'pg';

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

  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(voterKey, params.commentId, salt);
  const col = v.value.vote_type === 'up' ? 'upvotes' : 'downvotes';

  let votes: { upvotes: number; downvotes: number };
  let commentLikeNotif: import('@/types').Notification | null = null;
  try {
    ({ votes, commentLikeNotif } = await withTransaction(async (client: PoolClient) => {
      const existing = await client.query(
        'SELECT id FROM comment_votes WHERE comment_id = $1 AND voter_token = $2',
        [params.commentId, voterToken]
      );
      if (existing.rows.length > 0) {
        throw Object.assign(new Error('Ya votaste en este comentario'), { status: 409 });
      }

      await client.query(
        'INSERT INTO comment_votes (comment_id, voter_token, vote_type) VALUES ($1, $2, $3)',
        [params.commentId, voterToken, v.value.vote_type]
      );

      const res = await client.query(
        `UPDATE comments SET ${col} = ${col} + 1 WHERE id = $1 AND post_id = $2 RETURNING upvotes, downvotes, anon_id`,
        [params.commentId, params.id]
      );

      if (res.rows.length === 0) {
        throw Object.assign(new Error('Comentario no encontrado'), { status: 404 });
      }

      const commentAuthor: string = res.rows[0].anon_id;
      if (shouldApplyTrustForVote(voterUsername, commentAuthor)) {
        const delta = v.value.vote_type === 'up' ? 2 : -2;
        await applyTrustDelta(commentAuthor, delta, client);
      }

      const notif = v.value.vote_type === 'up'
        ? await createNotification(commentAuthor, 'comment_like', params.id, params.commentId, voterUsername, client)
        : null;

      return { votes: { upvotes: res.rows[0].upvotes, downvotes: res.rows[0].downvotes }, commentLikeNotif: notif };
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
