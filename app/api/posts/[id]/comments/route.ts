import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { sanitize } from '@/lib/sanitize';
import { generateAnonId } from '@/lib/hash';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await query(
    'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC',
    [params.id]
  );
  return NextResponse.json({ comments: result.rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const content = sanitize(body.content ?? '');
  const parentId: string | null = body.parent_id ?? null;

  if (!content || content.length > 300) {
    return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 });
  }

  let anonId: string;
  try {
    const raw = (await cookies()).get('session_user')?.value;
    anonId = raw ? (JSON.parse(raw).username ?? generateAnonId()) : generateAnonId();
  } catch {
    anonId = generateAnonId();
  }

  const result = await query(
    'INSERT INTO comments (post_id, parent_id, anon_id, content) VALUES ($1, $2, $3, $4) RETURNING *',
    [params.id, parentId, anonId, content]
  );

  return NextResponse.json({ comment: result.rows[0] }, { status: 201 });
}
