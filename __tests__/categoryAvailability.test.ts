jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { isCategoryAvailable, RETIRED_CATEGORIES } from '@/lib/categoryAvailability';
import { categoryExists, listCategories, SYSTEM_CATEGORIES } from '@/lib/categories';
import { query } from '@/lib/db';

describe('retired categories', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['stickers', 'confesiones'])('blocks %s without changing stored data', async (slug) => {
    expect(isCategoryAvailable(slug)).toBe(false);
    expect(await categoryExists(slug)).toBe(false);
    expect(query).not.toHaveBeenCalled();
    expect(SYSTEM_CATEGORIES.some((category) => category.slug === slug)).toBe(false);
  });

  it.each(['general', 'quemones', 'infieles', 'custom-category'])('keeps %s available', (slug) => {
    expect(isCategoryAvailable(slug)).toBe(true);
  });

  it('excludes retired categories from the database listing', async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [] });
    await listCategories();
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE slug <> ALL($1::text[])'),
      [RETIRED_CATEGORIES]
    );
  });
});
