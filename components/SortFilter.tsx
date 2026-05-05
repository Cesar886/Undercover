'use client';

export type SortOption = 'recent' | 'top' | 'hot';

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recientes' },
  { value: 'top',    label: 'Top semana' },
  { value: 'hot',    label: 'Polémicos' },
];

interface SortFilterProps {
  active: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortFilter({ active, onChange }: SortFilterProps) {
  return (
    <div className="flex gap-1.5">
      {SORTS.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            active === s.value
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
