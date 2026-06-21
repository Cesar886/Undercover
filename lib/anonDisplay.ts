/** Convert an anon_id (64-char hex hash) to a short display label. */
export function anonDisplayName(anonId: string): string {
  if (/^[0-9a-f]{64}$/.test(anonId)) {
    return `Anon#${anonId.slice(0, 4).toUpperCase()}`;
  }
  return anonId; // legacy username from before the anonymous migration
}
