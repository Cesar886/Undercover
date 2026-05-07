export function sanitize(input: string): string {
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .normalize('NFKC')
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
    .replace(/[ \t]{4,}/g, '  ')
    .trim();
}
