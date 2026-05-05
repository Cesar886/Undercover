import { checkRateLimit, _resetForTesting } from '@/lib/rateLimit';

beforeEach(() => _resetForTesting());

describe('checkRateLimit', () => {
  it('allows first 40 requests from same IP', () => {
    for (let i = 0; i < 40; i++) {
      expect(checkRateLimit('1.2.3.4')).toBe(true);
    }
  });
  it('blocks 41st request from same IP', () => {
    for (let i = 0; i < 40; i++) checkRateLimit('1.2.3.4');
    expect(checkRateLimit('1.2.3.4')).toBe(false);
  });
  it('allows different IPs independently', () => {
    for (let i = 0; i < 40; i++) checkRateLimit('1.2.3.4');
    expect(checkRateLimit('5.6.7.8')).toBe(true);
  });
  it('resets after the time window', () => {
    jest.useFakeTimers();
    for (let i = 0; i < 40; i++) checkRateLimit('1.2.3.4');
    expect(checkRateLimit('1.2.3.4')).toBe(false);
    jest.advanceTimersByTime(61 * 60 * 1000);
    expect(checkRateLimit('1.2.3.4')).toBe(true);
    jest.useRealTimers();
  });
});
