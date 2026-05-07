import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword } from '@/lib/hash';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = (body.username ?? '').trim();
  const password = (body.password ?? '').trim();

  if (!username || !password) {
    return NextResponse.json({ error: 'Completa todos los campos' }, { status: 400 });
  }

  const result = await query(
    'SELECT id, username, password FROM users WHERE username = $1',
    [username]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  const user = result.rows[0];
  const passwordMatch = await comparePassword(password, user.password);

  if (!passwordMatch) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  const safeUser = { id: user.id, username: user.username };
  const response = NextResponse.json({ user: safeUser });
  response.cookies.set('session_user', JSON.stringify(safeUser), {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });
  return response;
}
