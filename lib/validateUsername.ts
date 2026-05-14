const LEET_MAP: Record<string, string> = {
  '@': 'a', '4': 'a',
  '3': 'e',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o',
  '5': 's', '$': 's',
  '7': 't',
};

const BLOCKED_WORDS = [
  'admin', 'administrador', 'moderador', 'moderator',
  'soporte', 'support', 'staff', 'sistema', 'system',
  'root', 'superuser', 'webmaster',
];

export function validateUsername(username: string): string | null {
  const letters = username.match(/\p{L}/gu) ?? [];
  if (letters.length < 3) {
    return 'El alias debe tener al menos 3 letras';
  }

  const normalized = username
    .toLowerCase()
    .split('')
    .map((c) => LEET_MAP[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '');

  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(word)) {
      return 'Ese alias usa un nombre reservado';
    }
  }

  return null;
}
