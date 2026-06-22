'use client';
import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SIZE  = 2000;
const QUALITY   = 0.8;

interface ImagePickerProps {
  preview: string | null;
  onPick: (dataUrl: string) => void;
  onClear: () => void;
  onError: (msg: string) => void;
  disabled?: boolean;
  uploading?: boolean;
}

function targetDimensions(w: number, h: number): { width: number; height: number } {
  if (w <= MAX_SIZE && h <= MAX_SIZE) return { width: w, height: h };
  if (w > h) return { width: MAX_SIZE, height: Math.round((h * MAX_SIZE) / w) };
  return { width: Math.round((w * MAX_SIZE) / h), height: MAX_SIZE };
}

// Convierte ArrayBuffer → data URL sin depender de FileReader en el hilo principal.
function bufToDataUrl(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/webp;base64,${btoa(binary)}`;
}

// Fallback: procesamiento en hilo principal con canvas normal.
function processOnMainThread(
  file: File,
  onPick: (d: string) => void,
  onError: (m: string) => void,
) {
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result;
    if (typeof result !== 'string') return;
    const img = new Image();
    img.onload = () => {
      const { width, height } = targetDimensions(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const webpDataUrl = canvas.toDataURL('image/webp', QUALITY);
        const approxBytes = Math.round((webpDataUrl.length * 3) / 4);
        if (approxBytes > MAX_BYTES) {
          onError('La imagen es demasiado grande incluso después de comprimir');
        } else {
          onPick(webpDataUrl);
        }
      } else {
        if (file.size > MAX_BYTES) onError('Imagen excede 2MB');
        else onPick(result);
      }
    };
    img.onerror = () => onError('No se pudo procesar la imagen');
    img.src = result;
  };
  reader.onerror = () => onError('No se pudo leer el archivo');
  reader.readAsDataURL(file);
}

// Ruta principal: OffscreenCanvas en Web Worker → no bloquea la UI.
async function processInWorker(
  file: File,
  onPick: (d: string) => void,
  onError: (m: string) => void,
) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = targetDimensions(bitmap.width, bitmap.height);

  const worker = new Worker('/workers/image-processor.js');

  worker.onmessage = (e: MessageEvent<{ ok: boolean; buf?: ArrayBuffer; error?: string }>) => {
    worker.terminate();
    const { ok, buf, error } = e.data;
    if (!ok || !buf) {
      onError(error ?? 'Error procesando imagen');
      return;
    }
    const approxBytes = buf.byteLength;
    if (approxBytes > MAX_BYTES) {
      onError('La imagen es demasiado grande incluso después de comprimir');
      return;
    }
    onPick(bufToDataUrl(buf));
  };

  worker.onerror = () => {
    worker.terminate();
    processOnMainThread(file, onPick, onError);
  };

  // El bitmap se transfiere al worker (zero-copy); ya no es usable en el hilo principal.
  worker.postMessage({ bitmap, width, height, quality: QUALITY }, [bitmap as unknown as Transferable]);
}

function processFile(
  file: File,
  onPick: (d: string) => void,
  onError: (m: string) => void,
) {
  const supportsWorker       = typeof Worker !== 'undefined';
  const supportsOffscreen    = typeof OffscreenCanvas !== 'undefined';
  const supportsImageBitmap  = typeof createImageBitmap !== 'undefined';

  if (supportsWorker && supportsOffscreen && supportsImageBitmap) {
    processInWorker(file, onPick, onError).catch(() =>
      processOnMainThread(file, onPick, onError)
    );
  } else {
    processOnMainThread(file, onPick, onError);
  }
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
    processFile(file, onPick, onError);
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
