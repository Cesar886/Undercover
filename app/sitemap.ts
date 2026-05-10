import type { MetadataRoute } from 'next';
import { query } from '@/lib/db';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  ?? process.env.SITE_URL?.replace(/\/$/, '')
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

async function getPostUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const result = await query(
      `SELECT id, created_at, updated_at
       FROM posts
       WHERE is_hidden = false
       ORDER BY created_at DESC
       LIMIT 5000`,
    );
    return result.rows.map((row) => ({
      url: `${BASE_URL}/posts/${row.id}`,
      lastModified: new Date(row.updated_at ?? row.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const postUrls = await getPostUrls();

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/buscar`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/registro`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  return [...staticUrls, ...postUrls];
}
