// Retired categories stay in the database so existing content is preserved.
export const RETIRED_CATEGORIES = ['stickers', 'confesiones'];
export function isCategoryAvailable(slug: string): boolean {
  return !RETIRED_CATEGORIES.includes(slug);
}
