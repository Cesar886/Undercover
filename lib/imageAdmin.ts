import { createHash, randomBytes } from 'crypto';
import { compare } from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from './db';
import { ensureImageReviewSchema } from './imageReviews';

export const IMAGE_ADMIN_PATH = '/imagenes-dnewjlfe99474ef8wu-admin';
export const IMAGE_ADMIN_COOKIE = 'image_admin_session';
export const IMAGE_ADMIN_COOKIE_OPTIONS = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const, path: '/', maxAge: 8 * 60 * 60,
};
// Server-only password hash; neither the password nor this hash is sent to the browser.
const PASSWORD_HASH = '$2b$12$KBCqATeqvj1ZxPGeAA.0guflq5MX.HDVDIOqQNa/ajyMgp5qIJdTW';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export async function checkImageAdminCredentials(username: unknown, password: unknown) {
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 128) return false;
  const matches = await compare(password, PASSWORD_HASH);
  return username === 'admin' && matches;
}

export async function createImageAdminSession() {
  await ensureImageReviewSchema();
  const token = randomBytes(32).toString('hex');
  await query('DELETE FROM image_admin_sessions WHERE expires_at <= NOW()');
  await query("INSERT INTO image_admin_sessions (token_hash, expires_at) VALUES ($1, NOW() + INTERVAL '8 hours')", [digest(token)]);
  return token;
}

export async function hasImageAdminSession(): Promise<boolean> {
  const token = cookies().get(IMAGE_ADMIN_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  await ensureImageReviewSchema();
  const result = await query('SELECT 1 FROM image_admin_sessions WHERE token_hash = $1 AND expires_at > NOW()', [digest(token)]);
  return result.rows.length === 1;
}

export async function deleteImageAdminSession() {
  const token = cookies().get(IMAGE_ADMIN_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await ensureImageReviewSchema();
    await query('DELETE FROM image_admin_sessions WHERE token_hash = $1', [digest(token)]);
  }
}
