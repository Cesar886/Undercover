import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { hashVoterToken } from '@/lib/hash';
import { VoteType } from '@/types';
import { PoolClient } from 'pg';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const postId = params.id;
  const body = await request.json();
  const voteType: VoteType = body.vote_type;

  if (voteType !== 'up' && voteType !== 'down') {
    return NextResponse.json({ error: 'Tipo de voto inválido' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(ip, postId, salt);

  const existingVote = await query(
    'SELECT id FROM votes WHERE post_id = $1 AND voter_token = $2',
    [postId, voterToken]
  );

  if (existingVote.rows.length > 0) {
    return NextResponse.json({ error: 'Ya votaste en este post' }, { status: 409 });
  }

  // col is safe: derived from validated enum 'up' | 'down', never from raw user input
  const col = voteType === 'up' ? 'upvotes' : 'downvotes';
  const votes = await withTransaction(async (client: PoolClient) => {
    await client.query(
      'INSERT INTO votes (post_id, voter_token, vote_type) VALUES ($1, $2, $3)',
      [postId, voterToken, voteType]
    );
    const res = await client.query(
      `UPDATE posts SET ${col} = ${col} + 1 WHERE id = $1 RETURNING upvotes, downvotes`,
      [postId]
    );
    return res.rows[0];
  });

  return NextResponse.json({ votes });
}
