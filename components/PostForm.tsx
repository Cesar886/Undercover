'use client';
import { useState } from 'react';
import { PostCategory } from '@/types';
import { createPost } from '@/lib/localStore';

const CATEGORIES: { value: PostCategory; label: string; activeClass: string }[] = [
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-orange-500/10 border-orange-500 text-orange-600' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500/10 border-pink-500 text-pink-600' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600/10 border-purple-600 text-purple-700' },
  { value: 'rumores',     label: 'Rumores',     activeClass: 'bg-blue-500/10 border-blue-500 text-blue-600' },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent]   = useState('');
  const [category, setCategory] = useState<PostCategory>('quemones');
  const [loading, setLoading]   = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || loading) return;
    setLoading(true);
    setTimeout(() => {
      createPost(text, category);
      setContent('');
      setLoading(false);
      onPostCreated();
    }, 150);
  }

  const remaining = MAX_CHARS - content.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        placeholder="¿Qué está pasando en la U?"
        rows={3}
        className="w-full bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 border border-gray-200"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${remaining < 50 ? 'text-amber-500' : 'text-gray-400'}`}>
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
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
      >
        {loading ? 'Publicando...' : 'Soltar'}
      </button>
    </form>
  );
}
