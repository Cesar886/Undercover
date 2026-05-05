'use client';
import { useState } from 'react';
import { PostCategory } from '@/types';

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'chisme',    label: '🗣️ Chisme' },
  { value: 'opinion',   label: '💭 Opinión' },
  { value: 'queja',     label: '😤 Queja' },
  { value: 'confesion', label: '🤫 Confesión' },
  { value: 'pregunta',  label: '❓ Pregunta' },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('opinion');
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
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        placeholder="¿Qué está pasando en la U? 🔥"
        rows={3}
        className="w-full bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#D85A30]"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${remaining < 50 ? 'text-amber-400' : 'text-zinc-600'}`}>
          {remaining} restantes
        </span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PostCategory)}
          className="flex-1 bg-zinc-800 text-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D85A30]"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-[#D85A30] hover:bg-[#C04A20] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {loading ? 'Publicando...' : 'Soltar 🔥'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}
