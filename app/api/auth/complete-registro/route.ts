import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { sanitize } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get('pending_google')?.value;

    if (!raw) {
      return NextResponse.json({ error: 'Sesión expirada, vuelve a iniciar con Google' }, { status: 401 });
    }

    let googleId: string;
    let email: string;
    try {
      ({ googleId, email } = JSON.parse(raw));
    } catch {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 400 });
    }

    const body = await request.json();
    const username = sanitize(body.username ?? '').trim();

    if (/\s/.test(username)) {
      return NextResponse.json({ error: 'El alias no puede contener espacios' }, { status: 400 });
    }
    if (username.length < 1 || username.length > 30) {
      return NextResponse.json({ error: 'El alias debe tener entre 1 y 30 caracteres' }, { status: 400 });
    }

    const taken = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (taken.rows.length > 0) {
      return NextResponse.json({ error: 'Ese alias ya está en uso' }, { status: 409 });
    }

    const race = await query('SELECT id FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);
    if (race.rows.length > 0) {
      return NextResponse.json({ error: 'Esta cuenta ya fue registrada' }, { status: 409 });
    }

    const result = await query(
      'INSERT INTO users (username, email, google_id) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email, googleId]
    );

    const user = { id: result.rows[0].id, username: result.rows[0].username };
    const response = NextResponse.json({ user }, { status: 201 });

    response.cookies.set('session_user', JSON.stringify(user), {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    response.cookies.set('pending_google', '', { 
      path: '/', 
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return response;
  } catch (err) {
    console.error('[complete-registro]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
