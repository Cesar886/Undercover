type SecretBadge = 'trophy' | 'sparkle';

export function VerifiedBadge({ badge = 'sparkle' }: { badge?: SecretBadge | null }) {
  const trophy = badge === 'trophy';
  return <span role="img" aria-label={trophy ? 'Secreto deepum descubierto' : 'Secreto anónimo descubierto'} title={trophy ? 'Secreto deepum descubierto' : 'Secreto anónimo descubierto'} className="inline-flex shrink-0 align-middle text-[17px] leading-none">{trophy ? '🏆' : '✨'}</span>;
}
