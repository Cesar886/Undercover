import { PoolClient, QueryResult } from 'pg';
import { query } from '@/lib/db';
import { Post, PostPoll } from '@/types';

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

type PollRow = {
  poll_id: string;
  post_id: string;
  question: string;
  option_id: string;
  label: string;
  position: number;
  votes: number;
  user_vote_option_id: string | null;
};

const globalForPolls = globalThis as unknown as { __pollSchemaReady?: boolean };

function executorOrDefault(executor?: Queryable): Queryable {
  return executor ?? { query };
}

export async function ensurePollSchema(executor?: Queryable): Promise<void> {
  if (globalForPolls.__pollSchemaReady) return;

  const db = executorOrDefault(executor);
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS post_polls (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id    UUID        NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
      question   TEXT        NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS post_poll_options (
      id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      poll_id  UUID NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
      label    TEXT NOT NULL,
      position INT  NOT NULL CHECK (position >= 0 AND position < 6),
      UNIQUE (poll_id, position)
    );

    CREATE TABLE IF NOT EXISTS post_poll_votes (
      poll_id    UUID        NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
      option_id  UUID        NOT NULL REFERENCES post_poll_options(id) ON DELETE CASCADE,
      anon_id    TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (poll_id, anon_id)
    );

    CREATE INDEX IF NOT EXISTS idx_post_poll_options_poll_position
      ON post_poll_options (poll_id, position);

    CREATE INDEX IF NOT EXISTS idx_post_poll_votes_option
      ON post_poll_votes (option_id);

    ALTER TABLE post_polls ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '';

    ALTER TABLE post_poll_options DROP CONSTRAINT IF EXISTS post_poll_options_position_check;
    ALTER TABLE post_poll_options ADD CONSTRAINT post_poll_options_position_check
      CHECK (position >= 0 AND position < 6);
  `);

  if (!executor) {
    globalForPolls.__pollSchemaReady = true;
  }
}

export async function createPollForPost(
  client: PoolClient,
  postId: string,
  options: string[],
  question = ''
): Promise<void> {
  if (options.length === 0) return;
  await ensurePollSchema(client);

  const pollRes = await client.query<{ id: string }>(
    'INSERT INTO post_polls (post_id, question) VALUES ($1, $2) RETURNING id',
    [postId, question]
  );
  const pollId = pollRes.rows[0].id;

  for (const [index, label] of options.entries()) {
    await client.query(
      'INSERT INTO post_poll_options (poll_id, label, position) VALUES ($1, $2, $3)',
      [pollId, label, index]
    );
  }
}

export async function getPollsForPostIds(
  postIds: string[],
  anonId?: string | null,
  executor?: Queryable
): Promise<Map<string, PostPoll>> {
  const uniqueIds = Array.from(new Set(postIds)).filter(Boolean);
  const polls = new Map<string, PostPoll>();
  if (uniqueIds.length === 0) return polls;

  await ensurePollSchema(executor);

  const result = await executorOrDefault(executor).query(
    `SELECT
       pp.id AS poll_id,
       pp.post_id,
       pp.question,
       po.id AS option_id,
       po.label,
       po.position,
       COUNT(pv.option_id)::int AS votes,
       my_vote.option_id AS user_vote_option_id
     FROM post_polls pp
     JOIN post_poll_options po ON po.poll_id = pp.id
     LEFT JOIN post_poll_votes pv ON pv.option_id = po.id
     LEFT JOIN post_poll_votes my_vote
       ON my_vote.poll_id = pp.id AND my_vote.anon_id = $2
     WHERE pp.post_id = ANY($1::uuid[])
     GROUP BY pp.id, pp.post_id, pp.question, po.id, po.label, po.position, my_vote.option_id
     ORDER BY pp.post_id, po.position ASC`,
    [uniqueIds, anonId ?? null]
  );

  for (const row of result.rows as PollRow[]) {
    const existing: PostPoll = polls.get(row.post_id) ?? {
      id: row.poll_id,
      post_id: row.post_id,
      question: row.question,
      options: [],
      total_votes: 0,
      user_vote_option_id: row.user_vote_option_id,
    };

    existing.options.push({
      id: row.option_id,
      label: row.label,
      position: row.position,
      votes: row.votes,
    });
    existing.total_votes += row.votes;
    existing.user_vote_option_id = row.user_vote_option_id;
    polls.set(row.post_id, existing);
  }

  return polls;
}

export async function getPollForPost(
  postId: string,
  anonId?: string | null,
  executor?: Queryable
): Promise<PostPoll | null> {
  const polls = await getPollsForPostIds([postId], anonId, executor);
  return polls.get(postId) ?? null;
}

export async function attachPollsToPosts<T extends Post>(
  posts: T[],
  anonId?: string | null,
  executor?: Queryable
): Promise<T[]> {
  if (posts.length === 0) return posts;
  const polls = await getPollsForPostIds(posts.map((post) => post.id), anonId, executor);
  return posts.map((post) => ({ ...post, poll: polls.get(post.id) ?? null }));
}

export function publicPoll(poll: PostPoll): PostPoll {
  return { ...poll, user_vote_option_id: null };
}
