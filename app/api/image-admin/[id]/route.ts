import { NextRequest, NextResponse } from 'next/server';
import { hasImageAdminSession } from '@/lib/imageAdmin';
import { query } from '@/lib/db';
import { ensureImageReviewSchema } from '@/lib/imageReviews';
import { isUuid } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!await hasImageAdminSession()) return new NextResponse(null, { status: 401, headers });
  if (!isUuid(params.id)) return new NextResponse(null, { status: 400, headers });
  await ensureImageReviewSchema();
  const result = await query(
    `SELECT COALESCE(r.image_data, p.image_webp, c.image_webp) AS image_data
     FROM image_reviews r
     LEFT JOIN posts p ON p.id = r.post_id
     LEFT JOIN comments c ON c.id = r.comment_id
     WHERE r.id = $1`,
    [params.id]
  );
  const data = result.rows[0]?.image_data;
  if (!data) return new NextResponse(null, { status: 404, headers });
  return new NextResponse(Buffer.from(data.split(',')[1], 'base64'), {
    headers: { ...headers, 'Content-Type': 'image/webp' },
  });
}
