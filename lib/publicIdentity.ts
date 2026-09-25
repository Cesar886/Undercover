import { createHmac } from 'crypto';

/** Public pseudonym: stable only within one thread, never an authorization key. */
export function threadAlias(internalId: string, threadId: string): string {
  const secret = process.env.ANON_SALT;
  if (!secret) throw new Error('ANON_SALT env var is required');
  if (!internalId || !threadId) throw new Error('Identity and thread are required');
  return createHmac('sha256', secret)
    .update(JSON.stringify(['public-thread-alias-v1', threadId.toLowerCase(), internalId]))
    .digest('hex');
}
