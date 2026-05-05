'use client';
import { PostCategory } from '@/types';

const FILTERS: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all',       label: 'Todo' },
  { value: 'chisme',    label: 'Chisme' },
  { value: 'opinion',   label: 'Opinión' },
  { value: 'queja',     label: 'Queja' },
  { value: 'confesion', label: 'Confesión' },
  { value: 'pregunta',  label: 'Pregunta' },
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
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-colors ${
            active === f.value
              ? 'bg-[#D85A30] text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
