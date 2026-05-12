'use client';
import { PostCategory } from '@/types';

const FILTERS: { value: PostCategory | 'all'; label: string; activeClass: string }[] = [
  { value: 'all',         label: 'Todo',        activeClass: 'bg-orange-500 text-white border-orange-500' },
  { value: 'general',     label: 'General',     activeClass: 'bg-zinc-500 text-white border-zinc-500' },
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-orange-500 text-white border-orange-500' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500 text-white border-pink-500' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600 text-white border-purple-600' },
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
              : 'bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
