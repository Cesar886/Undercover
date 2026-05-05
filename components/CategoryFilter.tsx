'use client';
import { PostCategory } from '@/types';

const FILTERS: { value: PostCategory | 'all'; label: string; activeClass: string }[] = [
  { value: 'all',         label: 'Todo',        activeClass: 'bg-orange-500 text-white border-orange-500' },
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-orange-500 text-white border-orange-500' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500 text-white border-pink-500' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600 text-white border-purple-600' },
  { value: 'rumores',     label: 'Rumores',     activeClass: 'bg-blue-500 text-white border-blue-500' },
];

interface CategoryFilterProps {
  active: PostCategory | 'all';
  onChange: (value: PostCategory | 'all') => void;
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-colors ${
            active === f.value
              ? f.activeClass
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
