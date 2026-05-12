import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername, unauthorized } from '@/lib/auth';
import { markNotificationRead } from '@/lib/notifications';
import { isUuid } from '@/lib/validation';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const username = await getSessionUsername();
  if (!username) return unauthorized();

  await markNotificationRead(params.id, username);
  return NextResponse.json({ ok: true });
}
