'use client';
import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown } from 'lucide-react';

export type SortOption = 'recent' | 'top' | 'hot';

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recientes' },
  { value: 'top',    label: 'Top semana' },
  { value: 'hot',    label: 'Polémicos' },
];

interface SortFilterProps {
  active: SortOption;
  onChange: (value: SortOption) => void;
  compact?: boolean;
}

export function SortFilter({ active, onChange, compact }: SortFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (compact) {
    const activeLabel = SORTS.find((s) => s.value === active)?.label ?? 'Ordenar';
    return (
      <div ref={ref} className="relative flex-shrink-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors py-1"
        >
          <ArrowUpDown size={13} strokeWidth={1.5} />
          <span className="hidden sm:inline whitespace-nowrap">{activeLabel}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[130px] z-50">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => { onChange(s.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  active === s.value
                    ? 'text-orange-600 font-semibold bg-orange-50 dark:bg-orange-500/10'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

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
