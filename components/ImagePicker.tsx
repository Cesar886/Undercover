'use client';
import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

const MAX_BYTES = 2 * 1024 * 1024;

interface ImagePickerProps {
  preview: string | null;
  onPick: (dataUrl: string) => void;
  onClear: () => void;
  onError: (msg: string) => void;
  disabled?: boolean;
  uploading?: boolean;
}

export function ImagePicker({ preview, onPick, onClear, onError, disabled, uploading }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError('El archivo no es una imagen');
      return;
    }
    if (file.size > MAX_BYTES) {
      onError('Imagen excede 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') onPick(result);
    };
    reader.onerror = () => onError('No se pudo leer el archivo');
    reader.readAsDataURL(file);
  }

  if (preview) {
    return (
      <div className="relative inline-block mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="preview" className="max-h-40 rounded-lg border border-gray-200" />
        {uploading && (
          <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center">
            <span className="text-xs text-gray-600">Subiendo...</span>
          </div>
        )}
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || uploading}
          className="absolute -top-2 -right-2 bg-white border border-gray-200 shadow-sm rounded-full p-1 text-gray-500 hover:text-red-500 disabled:opacity-50"
          aria-label="Quitar imagen"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="text-gray-400 hover:text-mauve-600 disabled:opacity-40 transition-colors p-1.5 rounded-full"
        aria-label="Adjuntar imagen"
        title="Adjuntar imagen"
      >
        <ImagePlus size={16} />
      </button>
    </>
  );
}
