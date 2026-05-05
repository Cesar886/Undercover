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
    <div className="flex gap-5">
      {SORTS.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={`pb-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            active === s.value
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
