import { PostCategory } from '@/types';
import type { Category } from '@/lib/categories';

export interface Board {
  slug: PostCategory;
  name: string;
  description: string;
  isSystem?: boolean;
  bg: string;
  border: string;
  text: string;
  glow: string;
}

const PALETTE = [
  { bg: 'rgba(14,165,233,0.07)', border: '#0ea5e9', text: '#0284c7', glow: '0 0 0 1px #0ea5e930, 0 2px 10px rgba(14,165,233,0.25)' },
  { bg: 'rgba(16,185,129,0.07)', border: '#10b981', text: '#059669', glow: '0 0 0 1px #10b98130, 0 2px 10px rgba(16,185,129,0.25)' },
  { bg: 'rgba(245,158,11,0.07)', border: '#f59e0b', text: '#d97706', glow: '0 0 0 1px #f59e0b30, 0 2px 10px rgba(245,158,11,0.25)' },
  { bg: 'rgba(139,92,246,0.07)', border: '#8b5cf6', text: '#7c3aed', glow: '0 0 0 1px #8b5cf630, 0 2px 10px rgba(139,92,246,0.25)' },
];

function styleFor(slug: string) {
  let hash = 0;
  for (const char of slug) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export const BOARDS: Board[] = [
  { slug: 'general', name: 'General', description: 'Que esta pasando en la U', isSystem: true, bg: 'rgba(100,116,139,0.07)', border: '#94a3b8', text: '#475569', glow: '0 0 0 1px #94a3b840, 0 2px 10px rgba(148,163,184,0.30)' },
  { slug: 'quemones', name: 'Quemones', description: 'Quememos a todos', isSystem: true, bg: 'rgba(249,115,22,0.07)', border: '#f97316', text: '#ea580c', glow: '0 0 0 1px #f9731630, 0 2px 10px rgba(249,115,22,0.28)' },
  { slug: 'infieles', name: 'Infieles', description: 'Entre todos nos cuidamos', isSystem: true, bg: 'rgba(236,72,153,0.07)', border: '#ec4899', text: '#db2777', glow: '0 0 0 1px #ec489930, 0 2px 10px rgba(236,72,153,0.28)' },
];

export function toBoard(category: Category): Board {
  const fixed = BOARDS.find((board) => board.slug === category.slug);
  if (fixed) return fixed;
  return { ...category, isSystem: category.is_system, ...styleFor(category.slug) };
}

export function getBoard(slug: string, boards: Board[] = BOARDS): Board | undefined {
  return boards.find((board) => board.slug === slug);
}
