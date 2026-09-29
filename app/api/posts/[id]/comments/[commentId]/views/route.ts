import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/validation';
import { incrementCommentView } from '@/lib/views';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  if (!isUuid(params.id) || !isUuid(params.commentId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
  await incrementCommentView(params.id, params.commentId);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
