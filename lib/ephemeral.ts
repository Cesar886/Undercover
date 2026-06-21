import { PoolClient } from 'pg';

// Threads last forever — no pruning, no expiry.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function pruneCategory(_category: string, _client: PoolClient): Promise<void> {}

export async function cleanupExpired(): Promise<{ expired: number }> {
  return { expired: 0 };
}
