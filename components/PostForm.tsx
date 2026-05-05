'use client';
import { useState } from 'react';
import { PostCategory } from '@/types';

const CATEGORIES: { value: PostCategory; label: string; activeClass: string }[] = [
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-orange-500/15 border-orange-500 text-orange-500' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500/15 border-pink-500 text-pink-500' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600/15 border-purple-600 text-purple-600' },
  { value: 'rumores',     label: 'Rumores',     activeClass: 'bg-blue-500/15 border-blue-500 text-blue-500' },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('quemones');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al publicar');
        return;
      }
      setContent('');
      onPostCreated();
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  const remaining = MAX_CHARS - content.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#111111] border border-[#222222] rounded-xl p-4 space-y-3"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        placeholder="¿Qué está pasando en la U?"
        rows={3}
        className="w-full bg-zinc-900 text-[#F5F5F5] placeholder-[#404040] rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#F4622A]"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${remaining < 50 ? 'text-amber-400' : 'text-zinc-600'}`}>
          {remaining} restantes
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              category === c.value
                ? c.activeClass
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="w-full bg-[#F4622A] hover:bg-orange-600 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
      >
        {loading ? 'Publicando...' : 'Soltar'}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}
