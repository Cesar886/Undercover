const STORAGE_KEY = 'deepum_owner_token';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readOwnerToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.localStorage.getItem(STORAGE_KEY);
    return token && UUID_RE.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function ensureOwnerToken(): string | null {
  const existing = readOwnerToken();
  if (existing) return existing;
  if (typeof window === 'undefined' || !window.crypto?.randomUUID) return null;
  try {
    const token = window.crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export function ownerTokenHeaders(): Record<string, string> {
  const token = ensureOwnerToken();
  return token ? { 'X-Owner-Token': token } : {};
}
