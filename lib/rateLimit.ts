interface Entry {
  count: number;
  resetAt: number;
}

interface Options {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

const DEFAULT_OPTS: Options = { windowMs: 60 * 60 * 1000, max: 40 };
const store = new Map<string, Entry>();

export function checkRateLimit(key: string, opts: Options = DEFAULT_OPTS): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (entry.count >= opts.max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { ok: true, retryAfter: 0 };
}

export const RATE_LIMITS = {
  posts:    { windowMs: 60 * 60 * 1000, max: 40 },
  comments: { windowMs: 60 * 60 * 1000, max: 60 },
  votes:    { windowMs: 60 * 60 * 1000, max: 200 },
  reports:  { windowMs: 60 * 60 * 1000, max: 20 },
} as const;

export function _resetForTesting() {
  store.clear();
}
