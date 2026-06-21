'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel, busy]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 animate-fade-in"
      onClick={() => { if (!busy) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="bg-white dark:bg-[#0d0b1a] dark:border dark:border-violet-500/20 dark:shadow-[0_8px_40px_rgba(124,58,237,0.2)] rounded-2xl shadow-xl w-full max-w-sm p-5 animate-fade-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-base font-semibold text-stone-900 dark:text-[#e9e5ff] mb-1.5">
          {title}
        </h2>
        {description && (
          <p className="text-[13px] text-stone-500 dark:text-[#6b6a8f] leading-relaxed mb-4">{description}</p>
        )}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-1.5 text-sm text-stone-500 dark:text-[#6b6a8f] hover:text-stone-800 dark:hover:text-violet-200 hover:bg-stone-100 dark:hover:bg-violet-500/10 rounded-lg transition-all"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-1.5 text-sm font-semibold text-white rounded-full transition-all shadow-sm active:scale-95 disabled:opacity-60 ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-stone-900 hover:bg-stone-800'
            }`}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
