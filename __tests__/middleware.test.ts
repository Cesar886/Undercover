import { NextRequest } from 'next/server';
import { isAiCrawler, middleware } from '@/middleware';

describe('AI crawler blocking middleware', () => {
  it.each(['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'ChatGPT-User'])('blocks %s', (agent) => {
    expect(isAiCrawler(agent)).toBe(true);
  });

  it('rejects known AI crawlers before they reach the app', () => {
    const request = new NextRequest('http://localhost/', { headers: { 'user-agent': 'GPTBot/1.0' } });
    const response = middleware(request);

    expect(response.status).toBe(403);
    expect(response.headers.get('x-robots-tag')).toContain('noai');
  });

  it('adds strict robot headers for normal requests', () => {
    const request = new NextRequest('http://localhost/', { headers: { 'user-agent': 'Mozilla/5.0' } });
    const response = middleware(request);

    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(response.headers.get('x-robots-tag')).toContain('noimageai');
  });
});
