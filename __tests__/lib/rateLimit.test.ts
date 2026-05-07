import { checkRateLimit, RATE_LIMITS, _resetForTesting } from '@/lib/rateLimit';

beforeEach(() => _resetForTesting());

describe('checkRateLimit', () => {
  it('allows up to max requests', () => {
    for (let i = 0; i < RATE_LIMITS.posts.max; i++) {
      expect(checkRateLimit('k1', RATE_LIMITS.posts).ok).toBe(true);
    }
  });

  it('blocks past max with retryAfter', () => {
    for (let i = 0; i < RATE_LIMITS.posts.max; i++) checkRateLimit('k1', RATE_LIMITS.posts);
    const r = checkRateLimit('k1', RATE_LIMITS.posts);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it('keys are independent', () => {
    for (let i = 0; i < RATE_LIMITS.posts.max; i++) checkRateLimit('k1', RATE_LIMITS.posts);
    expect(checkRateLimit('k2', RATE_LIMITS.posts).ok).toBe(true);
  });

  it('resets after window', () => {
    jest.useFakeTimers();
    for (let i = 0; i < RATE_LIMITS.posts.max; i++) checkRateLimit('k1', RATE_LIMITS.posts);
    expect(checkRateLimit('k1', RATE_LIMITS.posts).ok).toBe(false);
    jest.advanceTimersByTime(RATE_LIMITS.posts.windowMs + 1000);
    expect(checkRateLimit('k1', RATE_LIMITS.posts).ok).toBe(true);
    jest.useRealTimers();
  });

  it('different limit configs apply per call', () => {
    const opts = { windowMs: 1000, max: 2 };
    expect(checkRateLimit('x', opts).ok).toBe(true);
    expect(checkRateLimit('x', opts).ok).toBe(true);
    expect(checkRateLimit('x', opts).ok).toBe(false);
  });
});
