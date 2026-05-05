import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await query(
    `UPDATE posts
     SET report_count = report_count + 1,
         is_hidden = CASE WHEN report_count + 1 >= 10 THEN true ELSE is_hidden END
     WHERE id = $1
     RETURNING report_count, is_hidden`,
    [params.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...result.rows[0] });
}
