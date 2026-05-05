import { NextRequest, NextResponse } from 'next/server';
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

  if (!content || content.length > 300) {
    return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 });
  }

  const anonId = generateAnonId();
  const result = await query(
    'INSERT INTO comments (post_id, anon_id, content) VALUES ($1, $2, $3) RETURNING *',
    [params.id, anonId, content]
  );

  return NextResponse.json({ comment: result.rows[0] }, { status: 201 });
}
