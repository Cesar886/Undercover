export const BLOCKED_CONTENT_KEYWORDS = [
  'daniel110a',
  'telegram',
  'amayrani',
  'daniel',
  'hacerse pasar',
  'cesar',
  'hola123',
];

function normalizeForModeration(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX');
}

function compact(value: string): string {
  return normalizeForModeration(value).replace(/[^a-z0-9]+/g, '');
}

function spaced(value: string): string {
  return normalizeForModeration(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

export function shouldHideContent(content: string): boolean {
  const compactContent = compact(content);
  const spacedContent = ` ${spaced(content)} `;

  return BLOCKED_CONTENT_KEYWORDS.some((keyword) => {
    const compactKeyword = compact(keyword);
    if (compactKeyword && compactContent.includes(compactKeyword)) return true;

    const spacedKeyword = spaced(keyword);
    return Boolean(spacedKeyword && spacedContent.includes(` ${spacedKeyword} `));
  });
}

export const shouldHideCommentContent = shouldHideContent;
