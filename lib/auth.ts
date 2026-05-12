import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionValue, SessionPayload } from './session';

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const raw = (await cookies()).get('session_user')?.value;
    if (!raw) return null;
    return verifySessionValue(raw);
  } catch {
    return null;
  }
}

export async function getSessionUsername(): Promise<string | null> {
  const session = await getSession();
  return session?.username ?? null;
}

export async function getVoterKey(
  request: NextRequest,
): Promise<{ key: string; username: string | null }> {
  const session = await getSession();
  if (session?.username) return { key: `user:${session.username}`, username: session.username };
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  return { key: `ip:${ip}`, username: null };
}

export async function getReporterId(request: NextRequest): Promise<string> {
  const session = await getSession();
  if (session?.username) return `user:${session.username}`;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  return `anon:${ip}`;
}

export function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}
