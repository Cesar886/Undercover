import { checkRateLimit, _resetForTesting } from '@/lib/rateLimit';

beforeEach(() => _resetForTesting());

describe('checkRateLimit', () => {
  it('allows first 3 requests from same IP', () => {
    expect(checkRateLimit('1.2.3.4')).toBe(true);
    expect(checkRateLimit('1.2.3.4')).toBe(true);
    expect(checkRateLimit('1.2.3.4')).toBe(true);
  });
  it('blocks 4th request from same IP', () => {
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    expect(checkRateLimit('1.2.3.4')).toBe(false);
  });
  it('allows different IPs independently', () => {
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    expect(checkRateLimit('5.6.7.8')).toBe(true);
  });
  it('resets after the time window', () => {
    jest.useFakeTimers();
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    expect(checkRateLimit('1.2.3.4')).toBe(false);
    jest.advanceTimersByTime(61 * 60 * 1000);
    expect(checkRateLimit('1.2.3.4')).toBe(true);
    jest.useRealTimers();
  });
});
