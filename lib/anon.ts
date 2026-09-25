import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { ownerTokenFromRequest } from './visibility';

// The only anonymous identity input is the UUID stored in localStorage.
// Hashing hides the ownership credential; it does not prevent new identities.
export function getAnonId(request: NextRequest): { anonId: string } {
  const token = ownerTokenFromRequest(request);
  if (!token) throw new Error('Browser identifier missing or invalid');
  const salt = process.env.ANON_SALT;
  if (!salt) throw new Error('ANON_SALT env var is required');
  return { anonId: crypto.createHash('sha256').update(`${token}:${salt}`).digest('hex') };
}
