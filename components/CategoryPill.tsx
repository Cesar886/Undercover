import { PostCategory } from '@/types';

const config: Record<PostCategory, { label: string; className: string }> = {
  quemones:    { label: 'Quemones',    className: 'border border-mauve-600/40 dark:border-violet-500/25 text-mauve-600 dark:text-violet-300 bg-mauve-600/10 dark:bg-violet-500/8' },
  infieles:    { label: 'Infieles',    className: 'border border-pink-500/40 dark:border-violet-400/20 text-pink-500 dark:text-violet-400 bg-pink-500/10 dark:bg-violet-400/6' },
  confesiones: { label: 'Confesiones', className: 'border border-purple-600/40 dark:border-violet-600/25 text-purple-600 dark:text-violet-300 bg-purple-600/10 dark:bg-violet-600/8' },
  general:     { label: 'General',     className: 'border border-zinc-400/40 dark:border-violet-900/40 text-zinc-500 dark:text-[#4a4870] bg-zinc-400/10 dark:bg-violet-900/10' },
  stickers:    { label: 'Stickers',    className: 'border border-yellow-500/40 dark:border-yellow-400/20 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 dark:bg-yellow-400/6' },
};

export function CategoryPill({ category }: { category: PostCategory }) {
  const { label, className } = config[category];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>
      {label}
    </span>
  );
}
