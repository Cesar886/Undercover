import { NextRequest } from 'next/server';
import { reportContent } from '@/lib/communityModeration';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return reportContent(request, params.id);
}
