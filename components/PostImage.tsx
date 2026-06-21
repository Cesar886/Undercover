'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Maximize2 } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';

interface PostImageProps {
  src: string;
  alt?: string;
  priority?: boolean;
}

const FALLBACK = { width: 1200, height: 800 };

function shouldSkipOptimization(src: string): boolean {
  return src.startsWith('data:') || src.startsWith('blob:');
}

export function PostImage({ src, alt = 'Imagen adjunta', priority = false }: PostImageProps) {
  const [open, setOpen] = useState(false);
  const [dimensions, setDimensions] = useState(FALLBACK);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="group relative block max-h-28 overflow-hidden rounded-lg border border-black/[0.06] dark:border-violet-500/10 cursor-zoom-in"
        aria-label="Ver imagen completa"
      >
        <Image
          src={src}
          alt={alt}
          width={dimensions.width}
          height={dimensions.height}
          sizes="(max-width: 640px) 100vw, 600px"
          priority={priority}
          unoptimized={shouldSkipOptimization(src)}
          onLoad={(e) => {
            const w = e.currentTarget.naturalWidth || FALLBACK.width;
            const h = e.currentTarget.naturalHeight || FALLBACK.height;
            setDimensions((cur) => cur.width === w && cur.height === h ? cur : { width: w, height: h });
          }}
          className="w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          style={{ maxHeight: '7rem' }}
        />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-xl" />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Maximize2 size={10} strokeWidth={2} />
          Ver
        </span>
      </button>

      {open && <ImageLightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}
