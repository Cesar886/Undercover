'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_CHARS = 300;

export function CommentForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al comentar');
        return;
      }
      setContent('');
      router.refresh();
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        placeholder="Añade un comentario anónimo..."
        rows={2}
        className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${MAX_CHARS - content.length < 30 ? 'text-amber-500' : 'text-gray-400'}`}>
          {MAX_CHARS - content.length} restantes
        </span>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          {loading ? 'Enviando...' : 'Comentar'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </form>
  );
}
