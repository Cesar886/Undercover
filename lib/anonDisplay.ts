/** Display a thread-scoped public pseudonym. Never pass an internal identity. */
export function anonDisplayName(anonId: string): string {
  if (/^[0-9a-f]{64}$/.test(anonId)) {
    return `Anon#${anonId.slice(0, 8).toUpperCase()}`;
  }
  return 'Anónimo';
}
