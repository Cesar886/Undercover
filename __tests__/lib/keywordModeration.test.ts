import { shouldHideCommentContent } from '@/lib/keywordModeration';

describe('shouldHideCommentContent', () => {
  it('matches blocked comment keywords case-insensitively', () => {
    expect(shouldHideCommentContent('Daniel110a')).toBe(true);
    expect(shouldHideCommentContent('pasen telegram')).toBe(true);
    expect(shouldHideCommentContent('hola123')).toBe(true);
  });

  it('matches simple variants with accents and separators', () => {
    expect(shouldHideCommentContent('D a n i e l 110 A')).toBe(true);
    expect(shouldHideCommentContent('César')).toBe(true);
    expect(shouldHideCommentContent('hacerse-pasar')).toBe(true);
  });

  it('allows unrelated comments', () => {
    expect(shouldHideCommentContent('comentario normal para la comunidad')).toBe(false);
  });
});
