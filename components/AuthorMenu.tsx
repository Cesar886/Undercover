'use client';
import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

interface AuthorMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  size?: 'sm' | 'md';
}

export function AuthorMenu({ onEdit, onDelete, size = 'md' }: AuthorMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleDoc);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDoc);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-stone-300 hover:text-stone-600 transition-colors p-1 -m-1 rounded"
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={iconSize} strokeWidth={1.8} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#0d0b1a] border border-stone-200 dark:border-violet-500/20 rounded-lg shadow-lg dark:shadow-[0_8px_24px_rgba(124,58,237,0.15)] z-20 overflow-hidden animate-fade-in"
        >
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-stone-700 dark:text-violet-200/80 hover:bg-stone-50 dark:hover:bg-violet-500/10 text-left transition-colors"
          >
            <Pencil size={13} strokeWidth={1.8} />
            Editar
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 text-left transition-colors"
          >
            <Trash2 size={13} strokeWidth={1.8} />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
