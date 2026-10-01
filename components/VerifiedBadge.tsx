type SecretBadge = 'trophy' | 'sparkle' | 'aura';

function badgePresentation(badge: SecretBadge | null) {
  if (badge === 'trophy') return { icon: '\u{1F531}', label: 'Secreto deepum descubierto' };
  if (badge === 'aura') return { icon: '\u{1F525}', label: 'Aura descubierta' };
  return { icon: '\u{2728}', label: 'Secreto an\u00f3nimo descubierto' };
}

export function VerifiedBadge({ badge = 'sparkle' }: { badge?: SecretBadge | null }) {
  const presentation = badgePresentation(badge);
  return <span role="img" aria-label={presentation.label} title={presentation.label} className="inline-flex shrink-0 align-middle text-[17px] leading-none">{presentation.icon}</span>;
}
