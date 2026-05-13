'use client';
import { useState } from 'react';
import { ImageDown, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface ShareImageButtonProps {
  targetRef: React.RefObject<HTMLElement | null>;
  postId: string;
  className?: string;
  onError?: (msg: string) => void;
}

export function ShareImageButton({ targetRef, postId, className, onError }: ShareImageButtonProps) {
  const [generating, setGenerating] = useState(false);

  async function handleShare() {
    if (!targetRef.current || generating) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas empty'))), 'image/png');
      });

      const file = new File([blob], `quemados-${postId}.png`, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Post de QuemadosUM' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quemados-${postId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        onError?.('No se pudo generar la imagen');
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={generating}
      className={`text-stone-300 dark:text-zinc-600 hover:text-stone-500 dark:hover:text-zinc-400 transition-colors disabled:opacity-50 ${className ?? ''}`}
      title="Compartir como imagen"
      aria-label="Compartir post como imagen"
    >
      {generating
        ? <Loader2 size={13} className="animate-spin" />
        : <ImageDown size={13} strokeWidth={1.5} />}
    </button>
  );
}
