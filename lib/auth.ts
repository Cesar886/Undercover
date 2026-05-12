import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function getSessionUsername(): Promise<string | null> {
  try {
    const raw = (await cookies()).get('session_user')?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const u = parsed?.username;
    return typeof u === 'string' && u.trim() ? u.trim() : null;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}
