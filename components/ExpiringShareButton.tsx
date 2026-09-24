'use client';
import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { apiPost } from '@/lib/apiClient';

export function ExpiringShareButton({
  postId,
  commentId,
  compact = false,
  onError,
}: {
  postId: string;
  commentId?: string;
  compact?: boolean;
  onError?: (message: string) => void;
}) {
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (working) return;
    setWorking(true);
    const currentShareToken = new URLSearchParams(window.location.search).get('share');
    const result = await apiPost<{ url: string; expiresAt: string }>('/api/share-links', {
      kind: commentId ? 'comment' : 'post',
      postId,
      commentId,
      currentShareToken,
    });
    setWorking(false);
    if (!result.ok) {
      onError?.(result.error);
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: 'DeepUM', url: result.data.url });
      } else {
        await navigator.clipboard.writeText(result.data.url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') onError?.('No se pudo compartir el enlace');
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={working}
      title="Compartir enlace temporal"
      aria-label="Compartir enlace temporal"
      className="relative z-[10] inline-flex items-center gap-1 text-xs text-stone-300 transition-colors hover:text-violet-500 disabled:opacity-50 dark:text-[#4a4870] dark:hover:text-violet-300"
    >
      {copied ? <Check size={13} /> : <Share2 size={13} />}
      {!compact && <span>{working ? 'Creando…' : copied ? 'Copiado' : 'Compartir'}</span>}
    </button>
  );
}
