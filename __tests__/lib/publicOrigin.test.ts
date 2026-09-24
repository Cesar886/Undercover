import { NextRequest } from 'next/server';
import { publicOrigin } from '@/lib/publicOrigin';

const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
  else process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
});

it('uses the configured public domain instead of the internal request origin', () => {
  process.env.NEXT_PUBLIC_BASE_URL = 'https://quemonesum.site';
  const request = new NextRequest('http://localhost:3107/api/share-links');

  expect(publicOrigin(request)).toBe('https://quemonesum.site');
});

it('uses reverse-proxy headers when no public URL is configured', () => {
  delete process.env.NEXT_PUBLIC_BASE_URL;
  const request = new NextRequest('http://localhost:3107/api/share-links', {
    headers: {
      host: 'quemonesum.site',
      'x-forwarded-proto': 'https',
    },
  });

  expect(publicOrigin(request)).toBe('https://quemonesum.site');
});

it('ignores invalid configured protocols', () => {
  process.env.NEXT_PUBLIC_BASE_URL = 'javascript:alert(1)';
  const request = new NextRequest('http://localhost:3107/api/share-links', {
    headers: {
      'x-forwarded-host': 'quemonesum.site',
      'x-forwarded-proto': 'https',
    },
  });

  expect(publicOrigin(request)).toBe('https://quemonesum.site');
});
