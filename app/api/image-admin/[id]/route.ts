import { NextRequest, NextResponse } from 'next/server';
import { hasImageAdminSession } from '@/lib/imageAdmin';
import { query } from '@/lib/db';
import { isUuid } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!await hasImageAdminSession()) return new NextResponse(null, { status: 401, headers });
  if (!isUuid(params.id)) return new NextResponse(null, { status: 400, headers });
  const result = await query("SELECT image_data FROM image_reviews WHERE id = $1 AND status = 'pending'", [params.id]);
  const data = result.rows[0]?.image_data;
  if (!data) return new NextResponse(null, { status: 404, headers });
  return new NextResponse(Buffer.from(data.split(',')[1], 'base64'), { headers: { ...headers, 'Content-Type': 'image/webp' } });
}
