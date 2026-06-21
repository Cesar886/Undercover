const URL_TLDS = [
  'app',
  'art',
  'ai',
  'biz',
  'blog',
  'cc',
  'click',
  'cloud',
  'club',
  'co',
  'com',
  'dev',
  'edu',
  'es',
  'fm',
  'gg',
  'gob',
  'gov',
  'info',
  'io',
  'lat',
  'link',
  'live',
  'lol',
  'ly',
  'me',
  'media',
  'mil',
  'mx',
  'net',
  'news',
  'one',
  'online',
  'org',
  'page',
  'photo',
  'photos',
  'pro',
  'shop',
  'site',
  'social',
  'space',
  'store',
  'tech',
  'to',
  'today',
  'tv',
  'us',
  'video',
  'website',
  'wiki',
  'work',
  'world',
  'xyz',
];

const TLD_PATTERN = URL_TLDS.join('|');
const PROTOCOL_RE = /\b(?:hxxps?|https?|ftp)\s*[:：]\s*\/\s*\//i;
const WWW_RE = /\bwww\s*(?:\.|\s+(?:dot|punto)\s+)\s*[a-z0-9-]+/i;
const EMAIL_RE = /\b[a-z0-9._%+-]+\s*@\s*[a-z0-9.-]+\s*\.\s*[a-z]{2,}\b/i;
const DOMAIN_RE = new RegExp(
  `\\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:(?:\\s*\\.\\s*|\\s+(?:dot|punto)\\s+)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?:\\s*\\.\\s*|\\s+(?:dot|punto)\\s+)(?:${TLD_PATTERN})(?:\\b|\\s*[/?#:@])`,
  'i'
);

function normalizeForLinkDetection(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[［\[]\s*(?:dot|punto)\s*[］\]]/gi, ' dot ')
    .replace(/[（(]\s*(?:dot|punto)\s*[）)]/gi, ' dot ');
}

export function containsUrl(value: string): boolean {
  if (!value.trim()) return false;
  const text = normalizeForLinkDetection(value);
  return (
    PROTOCOL_RE.test(text) ||
    WWW_RE.test(text) ||
    EMAIL_RE.test(text) ||
    DOMAIN_RE.test(text)
  );
}
