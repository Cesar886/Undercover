'use client';
import { useState } from 'react';
import { ImageLightbox } from './ImageLightbox';

interface PostImageProps {
  src: string;
  className?: string;
}

export function PostImage({ src, className }: PostImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={`rounded-lg border border-gray-100 cursor-zoom-in ${className ?? ''}`}
      />
      {open && <ImageLightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}
