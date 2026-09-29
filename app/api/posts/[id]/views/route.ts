import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/validation';
import { incrementPostView } from '@/lib/views';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  await incrementPostView(params.id);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
