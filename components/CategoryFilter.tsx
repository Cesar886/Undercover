'use client';
import { PostCategory } from '@/types';

const FILTERS: { value: PostCategory | 'all'; label: string; activeClass: string }[] = [
  { value: 'all',         label: 'Todo',        activeClass: 'bg-mauve-600 dark:bg-violet-700 dark:border-violet-600 text-white border-mauve-600' },
  { value: 'general',     label: 'General',     activeClass: 'bg-zinc-500 dark:bg-violet-900 dark:border-violet-800 text-white border-zinc-500' },
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-mauve-600 dark:bg-violet-700 dark:border-violet-600 text-white border-mauve-600' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500 dark:bg-violet-600 dark:border-violet-500 text-white border-pink-500' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600 dark:bg-violet-800 dark:border-violet-700 text-white border-purple-600' },
];

interface CategoryFilterProps {
  active: PostCategory | 'all';
  onChange: (value: PostCategory | 'all') => void;
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-colors ${
            active === f.value
              ? f.activeClass
              : 'bg-white dark:bg-[#0d0b1a] text-gray-500 dark:text-[#6b6a8f] border-gray-200 dark:border-violet-500/20 hover:border-gray-300 dark:hover:border-violet-400/40 dark:hover:text-violet-300'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
