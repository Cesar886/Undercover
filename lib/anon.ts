import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'anon_token';
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
};

function deriveAnonId(token: string): string {
  const salt = process.env.ANON_SALT;
  if (!salt) throw new Error('ANON_SALT env var is required');
  return crypto
    .createHash('sha256')
    .update(`${token}:${salt}`)
    .digest('hex'); // full 64-char hex — used for auth comparisons in DB
}

export function getAnonId(request: NextRequest): { anonId: string; newToken?: string } {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) return { anonId: deriveAnonId(token) };
  const newToken = crypto.randomUUID();
  return { anonId: deriveAnonId(newToken), newToken };
}

export function setAnonCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}
