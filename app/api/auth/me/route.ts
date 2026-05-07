import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const raw = (await cookies()).get('session_user')?.value;
    if (!raw) return NextResponse.json({ user: null });
    return NextResponse.json({ user: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ user: null });
  }
}
