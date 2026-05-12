export type SessionPayload = { id: string; username: string };

const ENC = new TextEncoder();

function getSecret(): string {
  return process.env.SESSION_SECRET ?? 'dev-secret-change-in-production';
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENC.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function bufToB64(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

function encodePayload(payload: SessionPayload): string {
  const src = ENC.encode(JSON.stringify(payload));
  let binary = '';
  for (let i = 0; i < src.length; i++) binary += String.fromCharCode(src[i]);
  return btoa(binary);
}

function decodePayload(encoded: string): unknown {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function createSessionValue(payload: SessionPayload): Promise<string> {
  const data = encodePayload(payload);
  const key = await importKey();
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(data));
  return `${data}.${bufToB64(sig)}`;
}

export async function verifySessionValue(raw: string): Promise<SessionPayload | null> {
  try {
    const dot = raw.lastIndexOf('.');
    if (dot === -1) return null;
    const data = raw.slice(0, dot);
    const sigBytes = b64ToBuf(raw.slice(dot + 1));
    const key = await importKey();
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, ENC.encode(data));
    if (!valid) return null;
    const parsed = decodePayload(data) as Record<string, unknown>;
    if (typeof parsed?.username !== 'string' || !parsed.username.trim()) return null;
    return parsed as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 7,
  sameSite: 'lax' as const,
};
