import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createSessionValue, SESSION_COOKIE_OPTIONS } from '@/lib/session';

const ALLOWED_EMAIL = /^\d{7}@alumno\.um\.edu\.mx$/;

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  error?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  given_name: string;
}

async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  return res.json();
}

async function getGoogleUser(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_cancelled`);
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const tokens = await exchangeCode(code, redirectUri);

    if (tokens.error) {
      return NextResponse.redirect(`${baseUrl}/login?error=google_failed`);
    }

    const googleUser = await getGoogleUser(tokens.access_token);

    const email = googleUser.email.toLowerCase();
    if (!ALLOWED_EMAIL.test(email)) {
      return NextResponse.redirect(`${baseUrl}/login?error=email_not_allowed`);
    }

    // Check if user already exists
    const existing = await query(
      'SELECT id, username FROM users WHERE google_id = $1 OR email = $2',
      [googleUser.id, email]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      await query('UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL', [
        googleUser.id,
        user.id,
      ]);
      // If user has no username yet, send them to complete registration
      if (!user.username) {
        const pending = JSON.stringify({ googleId: googleUser.id, email });
        const response = NextResponse.redirect(`${baseUrl}/completar-registro`);
        response.cookies.set('pending_google', pending, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 10,
          sameSite: 'lax',
        });
        return response;
      }
      const safeUser = { id: user.id, username: user.username };
      const response = NextResponse.redirect(`${baseUrl}/`);
      response.cookies.set('session_user', await createSessionValue(safeUser), SESSION_COOKIE_OPTIONS);
      return response;
    }

    // New user → store Google info in a short-lived cookie and go to registration
    const pending = JSON.stringify({ googleId: googleUser.id, email });
    const response = NextResponse.redirect(`${baseUrl}/completar-registro`);
    response.cookies.set('pending_google', pending, {
      path: '/',
      httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 minutes to complete registration
      sameSite: 'lax',
    });
    return response;
  } catch {
    return NextResponse.redirect(`${baseUrl}/login?error=google_failed`);
  }
}
