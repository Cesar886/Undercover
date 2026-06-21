'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  src: string | null;
  onClose: () => void;
}

function shouldSkipOptimization(src: string): boolean {
  return src.startsWith('data:') || src.startsWith('blob:');
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white"
        aria-label="Cerrar"
      >
        <X size={20} />
      </button>
      <div
        className="relative h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="100vw"
          unoptimized={shouldSkipOptimization(src)}
          className="object-contain rounded-lg"
        />
      </div>
    </div>,
    document.body
  );
}
