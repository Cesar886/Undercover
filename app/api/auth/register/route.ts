import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitize } from '@/lib/sanitize';
import { hashPassword } from '@/lib/hash';
import { createSessionValue, SESSION_COOKIE_OPTIONS } from '@/lib/session';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = sanitize(body.username ?? '').trim();
  const password = (body.password ?? '').trim();

  if (/\s/.test(username)) {
    return NextResponse.json(
      { error: 'El alias no puede contener espacios' },
      { status: 400 }
    );
  }

  if (username.length < 1 || username.length > 30) {
    return NextResponse.json(
      { error: 'El alias debe tener entre 1 y 30 caracteres' },
      { status: 400 }
    );
  }

  if (password.length < 4) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 4 caracteres' },
      { status: 400 }
    );
  }

  const existing = await query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );

  if (existing.rows.length > 0) {
    return NextResponse.json(
      { error: 'Ese nombre de usuario ya está en uso' },
      { status: 409 }
    );
  }

  const hashedPassword = await hashPassword(password);

  const result = await query(
    'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, created_at',
    [username, hashedPassword]
  );

  const user = { id: result.rows[0].id, username: result.rows[0].username };
  const response = NextResponse.json({ user }, { status: 201 });
  response.cookies.set('session_user', await createSessionValue(user), SESSION_COOKIE_OPTIONS);
  return response;
}
