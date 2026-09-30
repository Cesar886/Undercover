/** @jest-environment jsdom */
import { act, render, waitFor } from '@testing-library/react';
import { PostCard } from '@/components/PostCard';
import type { Post } from '@/types';

jest.mock('@mantine/core', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  Avatar: () => null,
}));
jest.mock('@/components/ReactionsPanel', () => ({ ReactionsPanel: () => null }));

it('counts visible feed cards without a click, retries after reentry and avoids duplicate views', async () => {
  let notify: IntersectionObserverCallback = () => {};
  const disconnect = jest.fn();
  const observe = jest.fn();
  const observer = { observe, disconnect } as unknown as IntersectionObserver;
  global.IntersectionObserver = jest.fn((callback) => {
    notify = callback;
    return observer;
  });
  const fetchMock = jest.fn().mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValue({ ok: true });
  global.fetch = fetchMock;
  window.localStorage.clear();
  const post: Post = {
    id: '12345678-1234-4234-8234-123456789099', anon_id: 'anon', content: 'Post visible',
    category: 'general', upvotes: 0, downvotes: 0, report_count: 0, is_hidden: false,
    owner_hidden: false, image_webp: null, created_at: '2026-09-29T12:00:00Z',
    updated_at: null, last_bumped_at: '2026-09-29T12:00:00Z', archived: false,
  };
  const { container, unmount } = render(<PostCard post={post} />);
  expect(observe).toHaveBeenCalledWith(container.querySelector('article'));
  const enter = (ratio: number) => act(() => notify([
    { isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry,
  ], observer));

  enter(0);
  enter(0.05);
  expect(fetchMock).not.toHaveBeenCalled();
  enter(0.15);
  await act(async () => { await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  enter(0);
  enter(0.5);
  await waitFor(() => expect(window.localStorage.getItem(`quemadosum:viewed:post:${post.id}`)).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledTimes(2);
  enter(0);
  enter(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  unmount();
  expect(disconnect).toHaveBeenCalled();
});
