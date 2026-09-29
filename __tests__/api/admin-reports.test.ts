jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/imageAdmin', () => ({ hasImageAdminSession: jest.fn() }));
jest.mock('@/lib/imageAdminOrigin', () => ({ isImageAdminOrigin: jest.fn() }));
jest.mock('@/lib/communityModeration', () => ({ ensureCommunitySchema: jest.fn() }));

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { hasImageAdminSession } from '@/lib/imageAdmin';
import { isImageAdminOrigin } from '@/lib/imageAdminOrigin';
import { GET, PATCH, POST } from '@/app/api/image-admin/reports/route';

const targetId = '12345678-1234-4234-8234-123456789012';
const req = (method = 'GET', body?: unknown, url = 'http://localhost/api/image-admin/reports') => new NextRequest(url, {
  method,
  headers: { 'Content-Type': 'application/json', origin: 'http://localhost' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

beforeEach(() => {
  jest.clearAllMocks();
  (hasImageAdminSession as jest.Mock).mockResolvedValue(true);
  (isImageAdminOrigin as jest.Mock).mockReturnValue(true);
  (query as jest.Mock).mockResolvedValue({ rows: [] });
});

it('requires an admin session for reading and actions', async () => {
  (hasImageAdminSession as jest.Mock).mockResolvedValue(false);

  expect((await GET(req())).status).toBe(401);
  expect((await POST(req('POST', { target_type: 'post', target_id: targetId, action: 'reviewed' }))).status).toBe(401);
  expect((await PATCH(req('PATCH', { target_type: 'post', target_id: targetId }))).status).toBe(401);
  expect(query).not.toHaveBeenCalled();
});

it('rejects cross-origin mutations', async () => {
  (isImageAdminOrigin as jest.Mock).mockReturnValue(false);

  expect((await GET(req())).status).toBe(403);
  expect((await POST(req('POST', { target_type: 'post', target_id: targetId, action: 'dismissed' }))).status).toBe(403);
  expect((await PATCH(req('PATCH', { target_type: 'post', target_id: targetId }))).status).toBe(403);
});

it('lists grouped reports without reporter identifiers', async () => {
  (query as jest.Mock).mockImplementation(async (sql: string) => {
    if (sql.includes('WITH grouped')) return { rows: [{
      target_type: 'post', target_id: targetId, post_id: targetId, reason: 'spam', detail: null,
      content: 'reported post', image_webp: null, report_count: 2, review_status: 'pending',
      first_reported_at: '2026-09-29T01:00:00.000Z', latest_reported_at: '2026-09-29T02:00:00.000Z',
      reviewed_at: null, is_hidden: false, is_deleted: false, parent_hidden: false,
      reporter_id: 'should-not-leak', network_key: 'also-private',
    }] };
    if (sql.includes('GROUP BY review_status')) return { rows: [{ review_status: 'pending', count: 2 }] };
    return { rows: [] };
  });

  const response = await GET(req('GET', undefined, 'http://localhost/api/image-admin/reports?status=all&sort=recent'));
  expect(response.status).toBe(200);
  const body = await response.json();
  const json = JSON.stringify(body);
  expect(json).toContain('reported post');
  expect(json).not.toContain('should-not-leak');
  expect(json).not.toContain('also-private');
});

it('marks every report for a target as reviewed or dismissed', async () => {
  (query as jest.Mock).mockImplementation(async (sql: string) => {
    if (sql.includes('UPDATE community_reports')) return { rows: [{ target_type: 'post', target_id: targetId }] };
    return { rows: [] };
  });

  const response = await POST(req('POST', { target_type: 'post', target_id: targetId, action: 'reviewed' }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, status: 'reviewed' });
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('SET review_status = $3, reviewed_at = NOW()'), ['post', targetId, 'reviewed']);
});

it('can hide reported content without deleting it', async () => {
  (query as jest.Mock).mockImplementation(async (sql: string) => {
    if (sql.includes('UPDATE comments SET is_hidden = true')) return { rows: [{ id: targetId }] };
    return { rows: [] };
  });

  const response = await PATCH(req('PATCH', { target_type: 'comment', target_id: targetId }));
  expect(response.status).toBe(200);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE comments SET is_hidden = true'), [targetId]);
});
