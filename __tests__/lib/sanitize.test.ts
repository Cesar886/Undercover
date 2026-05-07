import { sanitize } from '@/lib/sanitize';

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>hello')).toBe('hello');
  });
  it('strips nested tags', () => {
    expect(sanitize('<b><i>bold italic</i></b>')).toBe('bold italic');
  });
  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
  it('passes through plain text', () => {
    expect(sanitize('hello world')).toBe('hello world');
  });
  it('returns empty string for empty input', () => {
    expect(sanitize('')).toBe('');
  });
  it('strips HTML attributes', () => {
    expect(sanitize('<a href="evil.com">click</a>')).toBe('click');
  });
  it('removes control characters', () => {
    expect(sanitize('hi\x00\x01\x02there')).toBe('hithere');
  });
  it('preserves newlines and tabs', () => {
    expect(sanitize('a\nb\tc')).toBe('a\nb\tc');
  });
  it('collapses excessive spaces', () => {
    expect(sanitize('a       b')).toBe('a  b');
  });
  it('normalizes unicode (NFKC)', () => {
    // U+FF21 (fullwidth A) → A
    expect(sanitize('Ａ')).toBe('A');
  });
});
