import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query, withTransaction } from '@/lib/db';
import { hashVoterToken } from '@/lib/hash';
import { emitFeed } from '@/lib/events';
import { validateVoteInput, isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { PoolClient } from 'pg';

// En IPs compartidas (Wi-Fi de la U), un solo voto bloquearía a todos los demás.
// Si hay sesión, la key usa el username; si no, cae al IP como último recurso.
function buildVoterKey(request: NextRequest, sessionRaw: string | undefined): string {
  if (sessionRaw) {
    try {
      const username = JSON.parse(sessionRaw).username;
      if (typeof username === 'string' && username.trim()) {
        return `user:${username.trim()}`;
      }
    } catch {
      // cae al IP
    }
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  return `ip:${ip}`;
}

async function readSession(): Promise<string | undefined> {
  try {
    return (await cookies()).get('session_user')?.value;
  } catch {
    return undefined;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const raw = await readSession();
  if (!raw) return NextResponse.json({ voted: null });

  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(buildVoterKey(request, raw), params.id, salt);

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

  const sessionRaw = await readSession();
  const voterKey = buildVoterKey(request, sessionRaw);

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
  const votes = await withTransaction(async (client: PoolClient) => {
    await client.query(
      'INSERT INTO votes (post_id, voter_token, vote_type) VALUES ($1, $2, $3)',
      [postId, voterToken, v.value.vote_type]
    );
    const res = await client.query(
      `UPDATE posts SET ${col} = ${col} + 1 WHERE id = $1 RETURNING upvotes, downvotes`,
      [postId]
    );
    return res.rows[0];
  });

  emitFeed({
    type: 'post:vote',
    postId,
    upvotes: votes.upvotes,
    downvotes: votes.downvotes,
  });

  return NextResponse.json({ votes });
}
