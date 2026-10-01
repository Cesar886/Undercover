import crypto from 'crypto';

export function hashVoterToken(browserId: string, postId: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${browserId}:${postId}:${salt}`)
    .digest('hex');
}

export function generateAnonId(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `Anónimo #${num}`;
}
