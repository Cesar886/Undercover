'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ImageReviewNoticeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImageReviewNoticeModal({ open, onClose }: ImageReviewNoticeModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/35 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-review-title"
    >
      <div
        className="relative w-full max-w-xs rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-xl animate-fade-slide-in dark:border-violet-500/20 dark:bg-[#0d0b1a]"
        onClick={(e) => e.stopPropagation()}
      >
        <CheckCircle2 className="mx-auto mb-3 text-violet-600 dark:text-violet-300" size={28} strokeWidth={1.8} />
        <h2 id="image-review-title" className="mb-1 text-base font-semibold text-stone-900 dark:text-[#e9e5ff]">
          Imagen en revisión
        </h2>
        <p className="text-[13px] leading-relaxed text-stone-500 dark:text-[#aaa4c4]">
          Tu imagen está en revisión. Solo tomará unos minutos antes de publicarse.
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 dark:bg-violet-700 dark:hover:bg-violet-600"
        >
          Entendido
        </button>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-stone-300 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-[#4a4870] dark:hover:bg-violet-500/10 dark:hover:text-violet-200"
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
    </div>,
    document.body
  );
}
