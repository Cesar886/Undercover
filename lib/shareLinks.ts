import crypto from 'crypto';

export type ShareGrant = {
  kind: 'post' | 'comment';
  postId: string;
  commentId?: string;
  exp: number;
};

const DEFAULT_TTL_SECONDS = 2 * 60 * 60;

function secret(): string {
  const value = process.env.SHARE_LINK_SECRET || process.env.ANON_SALT;
  if (!value) throw new Error('SHARE_LINK_SECRET or ANON_SALT is required');
  return value;
}

function signature(encodedPayload: string): string {
  return crypto.createHmac('sha256', secret()).update(encodedPayload).digest('base64url');
}

export function shareLinkTtlSeconds(): number {
  const configured = Number.parseInt(process.env.SHARE_LINK_TTL_SECONDS ?? '', 10);
  if (Number.isFinite(configured) && configured > 0) return configured;
  // Shared links are valid for two hours unless an explicit positive override is configured.
  return DEFAULT_TTL_SECONDS;
}

export function createShareToken(input: Omit<ShareGrant, 'exp'>): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + shareLinkTtlSeconds();
  const payload: ShareGrant = { ...input, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${encoded}.${signature(encoded)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifyShareToken(token: string | null | undefined): ShareGrant | null {
  if (!token) return null;
  const [encoded, providedSignature, extra] = token.split('.');
  if (!encoded || !providedSignature || extra) return null;

  const expected = signature(encoded);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ShareGrant;
    if (payload.kind !== 'post' && payload.kind !== 'comment') return null;
    if (typeof payload.postId !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.kind === 'comment' && typeof payload.commentId !== 'string') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function shareGrantCoversPost(grant: ShareGrant | null, postId: string): boolean {
  return Boolean(grant && grant.postId === postId);
}

export function shareGrantCoversComment(grant: ShareGrant | null, postId: string, commentId: string): boolean {
  return Boolean(grant && grant.kind === 'comment' && grant.postId === postId && grant.commentId === commentId);
}
