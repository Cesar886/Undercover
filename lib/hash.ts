import crypto from 'crypto';
import bcryptjs from 'bcryptjs';

export function hashVoterToken(ip: string, postId: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}:${postId}:${salt}`)
    .digest('hex');
}

export function generateAnonId(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `Anónimo #${num}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}
