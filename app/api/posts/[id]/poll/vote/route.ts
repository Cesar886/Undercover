import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { getAnonId, setAnonCookie } from '@/lib/anon';
import { emitFeed } from '@/lib/events';
import { ensurePollSchema, getPollForPost, publicPoll } from '@/lib/polls';
import { isUuid } from '@/lib/validation';
import { PostPoll } from '@/types';

type VoteOutcome =
  | { ok: true; poll: PostPoll }
  | { ok: false; status: number; error: string };

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const optionId = (body as Record<string, unknown>)?.option_id;
  if (!isUuid(optionId)) {
    return NextResponse.json({ error: 'Opción inválida' }, { status: 400 });
  }

  let anonId: string;
  let newToken: string | undefined;
  try {
    ({ anonId, newToken } = getAnonId(request));
  } catch {
    return NextResponse.json({ error: 'Error de identidad anónima' }, { status: 500 });
  }

  const outcome = await withTransaction<VoteOutcome>(async (client) => {
    await ensurePollSchema(client);

    const pollRes = await client.query<{ id: string; archived: boolean }>(
      `SELECT pp.id, p.archived
       FROM post_polls pp
       JOIN posts p ON p.id = pp.post_id
       WHERE pp.post_id = $1 AND p.is_hidden = false
       FOR UPDATE`,
      [params.id]
    );

    if (pollRes.rows.length === 0) {
      return { ok: false, status: 404, error: 'Encuesta no encontrada' };
    }

    if (pollRes.rows[0].archived) {
      return { ok: false, status: 403, error: 'La encuesta está cerrada' };
    }

    const pollId = pollRes.rows[0].id;
    const optionRes = await client.query(
      'SELECT id FROM post_poll_options WHERE id = $1 AND poll_id = $2',
      [optionId, pollId]
    );

    if (optionRes.rows.length === 0) {
      return { ok: false, status: 400, error: 'Opción inválida' };
    }

    await client.query(
      `INSERT INTO post_poll_votes (poll_id, option_id, anon_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, anon_id)
       DO UPDATE SET option_id = EXCLUDED.option_id, created_at = NOW()`,
      [pollId, optionId, anonId]
    );

    const poll = await getPollForPost(params.id, anonId, client);
    if (!poll) return { ok: false, status: 404, error: 'Encuesta no encontrada' };

    return { ok: true, poll };
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  emitFeed({ type: 'post:poll', postId: params.id, poll: publicPoll(outcome.poll) });

  const response = NextResponse.json({ poll: outcome.poll });
  if (newToken) setAnonCookie(response, newToken);
  return response;
}
