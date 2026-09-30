/** @jest-environment jsdom */

import { trackPostViewOnce, trackCommentViewOnce, createPostVisitTracker } from '@/lib/viewTracking';

const flushRequests = () => new Promise((resolve) => setTimeout(resolve, 0));

it('counts opening an already viewed feed post and each later visit without counting rerenders', async () => {
  const fetchMock = jest.mocked(global.fetch);
  fetchMock.mockResolvedValue({ ok: true } as Response);
  trackPostViewOnce('feed-then-open');
  await flushRequests();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const visit = createPostVisitTracker();
  await Promise.all([visit('feed-then-open'), visit('feed-then-open')]);
  await visit('feed-then-open');
  expect(fetchMock).toHaveBeenCalledTimes(2);

  const nextVisit = createPostVisitTracker();
  await nextVisit('feed-then-open');
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock).toHaveBeenLastCalledWith('/api/posts/feed-then-open/views', expect.objectContaining({
    headers: { 'X-Owner-Token': window.localStorage.getItem('deepum_owner_token') },
  }));
});

it('allows retrying a detail visit after network and server failures', async () => {
  const fetchMock = jest.mocked(global.fetch);
  fetchMock.mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    .mockResolvedValue({ ok: true } as Response);
  const visit = createPostVisitTracker();
  await visit('detail-retry');
  await visit('detail-retry');
  await visit('detail-retry');
  await visit('detail-retry');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = jest.fn();
});

it('remembers a post view only after the server accepts it', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce({ ok: true } as Response);

  trackPostViewOnce('post-1');
  await flushRequests();
  trackPostViewOnce('post-1');
  await flushRequests();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/posts/post-1/views', expect.objectContaining({
    method: 'POST',
    headers: { 'X-Owner-Token': window.localStorage.getItem('deepum_owner_token') },
  }));
  expect(window.localStorage.getItem('deepum_owner_token')).toMatch(/^[0-9a-f-]{36}$/);
  expect(window.localStorage.getItem('quemadosum:viewed:post:post-1')).toBeTruthy();
});

it('does not permanently suppress HTTP failures and deduplicates pending requests', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce({ ok: true });
  trackPostViewOnce('post-http');
  trackPostViewOnce('post-http');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await flushRequests();
  expect(window.localStorage.getItem('quemadosum:viewed:post:post-http')).toBeNull();
  trackPostViewOnce('post-http');
  await flushRequests();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('sends browser identity for comment impressions too', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce({ ok: true });
  trackCommentViewOnce('post-comment', 'comment-1');
  await flushRequests();
  expect(fetchMock).toHaveBeenCalledWith('/api/posts/post-comment/comments/comment-1/views', expect.objectContaining({
    headers: { 'X-Owner-Token': window.localStorage.getItem('deepum_owner_token') },
  }));
});

it('retries a post view when the previous request failed', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true } as Response);

  trackPostViewOnce('post-2');
  await flushRequests();
  trackPostViewOnce('post-2');
  await flushRequests();

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(window.localStorage.getItem('quemadosum:viewed:post:post-2')).toBeTruthy();
});
