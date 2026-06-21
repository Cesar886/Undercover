import { PostCategory } from '@/types';

export interface Board {
  slug: PostCategory;
  name: string;
  description: string;
  bg: string;
  border: string;
  text: string;
  glow: string;
}

export const BOARDS: Board[] = [
  {
    slug: 'general',
    name: 'General',
    description: 'Cualquier cosa que pase en la U',
    bg: 'rgba(100,116,139,0.07)',
    border: '#94a3b8',
    text: '#475569',
    glow: '0 0 0 1px #94a3b840, 0 2px 10px rgba(148,163,184,0.30)',
  },
  {
    slug: 'quemones',
    name: 'Quemones',
    description: 'Dramas, quemas y chismes universitarios',
    bg: 'rgba(249,115,22,0.07)',
    border: '#f97316',
    text: '#ea580c',
    glow: '0 0 0 1px #f9731630, 0 2px 10px rgba(249,115,22,0.28)',
  },
  {
    slug: 'infieles',
    name: 'Infieles',
    description: 'Lo que pasa cuando nadie está mirando',
    bg: 'rgba(236,72,153,0.07)',
    border: '#ec4899',
    text: '#db2777',
    glow: '0 0 0 1px #ec489930, 0 2px 10px rgba(236,72,153,0.28)',
  },
  {
    slug: 'confesiones',
    name: 'Confesiones',
    description: 'Lo que no le dirías a nadie en persona',
    bg: 'rgba(147,51,234,0.07)',
    border: '#9333ea',
    text: '#7e22ce',
    glow: '0 0 0 1px #9333ea30, 0 2px 10px rgba(147,51,234,0.28)',
  },
];

const VALID_SLUGS = new Set<string>(BOARDS.map((b) => b.slug));

export function isValidBoard(s: string): s is PostCategory {
  return VALID_SLUGS.has(s);
}

export function getBoard(slug: string): Board | undefined {
  return BOARDS.find((b) => b.slug === slug);
}
