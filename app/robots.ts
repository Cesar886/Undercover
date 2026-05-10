import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/posts/', '/buscar', '/login', '/registro'],
        disallow: [
          '/api/',
          '/guardados',
          '/completar-registro',
        ],
      },
    ],
    sitemap: 'https://quemonesum.site/sitemap.xml',
    host: 'https://quemonesum.site',
  };
}
