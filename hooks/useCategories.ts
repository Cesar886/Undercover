'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/apiClient';
import { BOARDS, Board, toBoard } from '@/lib/boards';
import type { Category } from '@/lib/categories';
import { isCategoryAvailable } from '@/lib/categoryAvailability';

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
