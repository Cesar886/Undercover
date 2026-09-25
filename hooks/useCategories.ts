'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/apiClient';
import { BOARDS, Board, toBoard } from '@/lib/boards';
import type { Category } from '@/lib/categories';
import { isCategoryAvailable } from '@/lib/categoryAvailability';

interface CategoryPageResponse {
  categories: Category[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export function useCategories() {
  const [categories, setCategories] = useState<Board[]>(BOARDS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await apiGet<{ categories: Category[] }>('/api/categories');
    if (result.ok) setCategories(result.data.categories.filter(c => isCategoryAvailable(c.slug)).map(toBoard));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const handleChange = () => refresh();
    window.addEventListener('categories:changed', handleChange);
    return () => window.removeEventListener('categories:changed', handleChange);
  }, [refresh]);

  return { categories, loading, refresh };
}

export function useCategoryPages(limit = 12) {
  const [categories, setCategories] = useState<Board[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = useCallback(async (nextPage: number, replace = false) => {
    setLoading(true);
    const params = new URLSearchParams({
      paged: 'true',
      page: String(nextPage),
      limit: String(limit),
    });
    const result = await apiGet<CategoryPageResponse>(`/api/categories?${params}`);
    if (result.ok) {
      const boards = result.data.categories
        .filter((category) => isCategoryAvailable(category.slug))
        .map(toBoard);
      setCategories((current) => {
        if (replace) return boards;
        const seen = new Set(current.map((category) => category.slug));
        return [...current, ...boards.filter((category) => !seen.has(category.slug))];
      });
      setPage(result.data.page);
      setHasMore(result.data.hasMore);
    }
    setLoading(false);
  }, [limit]);

  const refresh = useCallback(async () => {
    setHasMore(true);
    await loadPage(1, true);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadPage(page + 1);
  }, [hasMore, loadPage, loading, page]);

  useEffect(() => {
    loadPage(1, true);
    const handleChange = () => loadPage(1, true);
    window.addEventListener('categories:changed', handleChange);
    return () => window.removeEventListener('categories:changed', handleChange);
  }, [loadPage]);

  return { categories, loading, hasMore, refresh, loadMore };
}
