import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AI_CRAWLER_PATTERN = /(?:AI2Bot|Ai2Bot-Dolma|Amazonbot|anthropic-ai|Applebot-Extended|Bytespider|CCBot|ChatGPT-User|ClaudeBot|Claude-User|cohere-ai|Diffbot|FacebookBot|Google-Extended|GPTBot|ImagesiftBot|img2dataset|Meta-ExternalAgent|Meta-ExternalFetcher|OAI-SearchBot|omgili|omgilibot|PerplexityBot|Scrapy|Timpibot|YouBot)/i;

export function isAiCrawler(userAgent: string | null) {
  return AI_CRAWLER_PATTERN.test(userAgent ?? '');
}

export function middleware(request: NextRequest) {
  if (isAiCrawler(request.headers.get('user-agent'))) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex, unavailable_after: 1 Jan 2000 00:00:00 GMT, noai, noimageai',
      },
    });
  }

  const path = request.nextUrl.pathname;
  const needsIdentity = (path.startsWith('/api/posts') &&
    (request.method !== 'GET' || /\/(vote|reactions)$/.test(path))) ||
    (path === '/api/categories' && request.method === 'POST') ||
    (path === '/api/image-admin/session' && request.method === 'POST');
  if (needsIdentity && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.headers.get('x-owner-token')?.trim() ?? '')) {
    return NextResponse.json({ error: 'Identificador del navegador inválido o ausente' }, { status: 400 });
  }
  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai');
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|apple-touch-icon.png).*)'],
};
