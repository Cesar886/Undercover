import { hashVoterToken, generateAnonId } from '@/lib/hash';

describe('hashVoterToken', () => {
  it('returns a 64-character hex string', () => {
    const token = hashVoterToken('browser-one', 'post-id-123', 'salt-value');
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });
  it('returns different hashes for different post IDs', () => {
    const a = hashVoterToken('browser-one', 'post-1', 'salt');
    const b = hashVoterToken('browser-one', 'post-2', 'salt');
    expect(a).not.toBe(b);
  });
  it('returns same hash for identical inputs (deterministic)', () => {
    const a = hashVoterToken('browser-one', 'post-1', 'salt');
    const b = hashVoterToken('browser-one', 'post-1', 'salt');
    expect(a).toBe(b);
  });
  it('returns different hashes for different browser identifiers', () => {
    const a = hashVoterToken('browser-one', 'post-1', 'salt');
    const b = hashVoterToken('browser-two', 'post-1', 'salt');
    expect(a).not.toBe(b);
  });
});

describe('generateAnonId', () => {
  it('matches the "Anónimo #XXXX" pattern', () => {
    const id = generateAnonId();
    expect(id).toMatch(/^Anónimo #\d{4}$/);
  });
  it('generates IDs within 1000-9999 range', () => {
    for (let i = 0; i < 20; i++) {
      const id = generateAnonId();
      const num = parseInt(id.replace('Anónimo #', ''), 10);
      expect(num).toBeGreaterThanOrEqual(1000);
      expect(num).toBeLessThanOrEqual(9999);
    }
  });
});
