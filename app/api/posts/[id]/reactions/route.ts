import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { emitFeed } from '@/lib/events';
import { isUuid } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { getVoterKey } from '@/lib/auth';
import { hashVoterToken } from '@/lib/hash';
import { ReactionCounts, ReactionEmoji } from '@/types';

const VALID_EMOJIS: ReactionEmoji[] = ['❤️', '😂', '🤯', '🫶', '🙃', '🫪'];

async function getReactionCounts(postId: string): Promise<ReactionCounts> {
  const result = await query(
    `SELECT emoji, COUNT(*)::int AS count FROM post_reactions WHERE post_id = $1 GROUP BY emoji`,
    [postId]
  );
  const counts: ReactionCounts = {};
  for (const row of result.rows) {
    counts[row.emoji as ReactionEmoji] = row.count;
  }
  return counts;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const { key: voterKey } = await getVoterKey(request);
  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(voterKey, params.id, salt);

  const [countsResult, myResult] = await Promise.all([
    getReactionCounts(params.id),
    query('SELECT emoji FROM post_reactions WHERE post_id = $1 AND voter_token = $2', [params.id, voterToken]),
  ]);

  return NextResponse.json({
    counts: countsResult,
    myReaction: (myResult.rows[0]?.emoji ?? null) as ReactionEmoji | null,
  });
}

export async function POST(
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

  const emoji = (body as Record<string, unknown>).emoji as string | null;
  if (emoji !== null && !VALID_EMOJIS.includes(emoji as ReactionEmoji)) {
    return NextResponse.json({ error: 'Emoji inválido' }, { status: 400 });
  }

  const { key: voterKey } = await getVoterKey(request);

  const rl = checkRateLimit(`reactions:${voterKey}`, RATE_LIMITS.votes);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiadas reacciones. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(voterKey, params.id, salt);
  const postId = params.id;

  if (emoji === null) {
    await query('DELETE FROM post_reactions WHERE post_id = $1 AND voter_token = $2', [postId, voterToken]);
  } else {
    await query(
      `INSERT INTO post_reactions (post_id, voter_token, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, voter_token) DO UPDATE SET emoji = EXCLUDED.emoji`,
      [postId, voterToken, emoji]
    );
  }

  const counts = await getReactionCounts(postId);
  emitFeed({ type: 'post:reaction', postId, counts });

  return NextResponse.json({
    counts,
    myReaction: emoji as ReactionEmoji | null,
  });
}
