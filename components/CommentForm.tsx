'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePicker } from '@/components/ImagePicker';
import { apiPost } from '@/lib/apiClient';

const MAX_CHARS = 300;

export function CommentForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if ((!text && !image) || loading) return;

    setLoading(true);
    setError('');
    setImageError(null);

    const result = await apiPost(`/api/posts/${postId}/comments`, {
      content: text,
      image: image ?? undefined,
    });

    if (result.ok) {
      setContent('');
      setImage(null);
      router.refresh();
    } else {
      if (
        result.error.toLowerCase().includes('imagen') ||
        result.error.toLowerCase().includes('formato')
      ) {
        setImageError(result.error);
      } else {
        setError(result.error);
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" aria-busy={loading}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        placeholder="Añade un comentario anónimo..."
        rows={2}
        disabled={loading}
        className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-mauve-600 disabled:opacity-60"
      />
      <ImagePicker
        preview={image}
        onPick={(d) => { setImage(d); setImageError(null); }}
        onClear={() => { setImage(null); setImageError(null); }}
        onError={(m) => setImageError(m)}
        disabled={loading}
        uploading={loading && !!image}
      />
      {imageError && <p className="text-red-500 text-xs">{imageError}</p>}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${MAX_CHARS - content.length < 30 ? 'text-mauve-500' : 'text-gray-400'}`}>
          {MAX_CHARS - content.length} restantes
        </span>
        <button
          type="submit"
          disabled={loading || (!content.trim() && !image)}
          className="bg-mauve-600 hover:bg-mauve-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          {loading ? 'Enviando...' : 'Comentar'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </form>
  );
}
