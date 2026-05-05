'use client';
import { useState, useEffect } from 'react';
import { PostCategory } from '@/types';
import { createPost, getAnonId } from '@/lib/localStore';

const CATEGORIES: {
  value: PostCategory;
  label: string;
  activeClass: string;
  avatarClass: string;
}[] = [
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-orange-500/10 border-orange-500 text-orange-600', avatarClass: 'bg-orange-100 text-orange-600' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500/10 border-pink-500 text-pink-600',       avatarClass: 'bg-pink-100 text-pink-600' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600/10 border-purple-600 text-purple-700', avatarClass: 'bg-purple-100 text-purple-700' },
  { value: 'rumores',     label: 'Rumores',     activeClass: 'bg-blue-500/10 border-blue-500 text-blue-600',       avatarClass: 'bg-blue-100 text-blue-600' },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent]   = useState('');
  const [category, setCategory] = useState<PostCategory>('quemones');
  const [loading, setLoading]   = useState(false);
  const [anonId, setAnonId]     = useState('');

  useEffect(() => { setAnonId(getAnonId()); }, []);

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

  const remaining    = MAX_CHARS - content.length;
  const selectedCat  = CATEGORIES.find((c) => c.value === category)!;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
    >
      {/* Composer body */}
      <div className="flex gap-3 px-4 pt-4 pb-2">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs ${selectedCat.avatarClass}`}>
          AN
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 mb-1.5">{anonId || 'Anónimo'}</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            placeholder="¿Qué está pasando en la U?"
            rows={3}
            className="w-full bg-transparent text-gray-900 placeholder-gray-300 text-[15px] leading-relaxed resize-none focus:outline-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                category === c.value
                  ? c.activeClass
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          {remaining < 100 && (
            <span className={`text-xs tabular-nums ${remaining < 30 ? 'text-amber-500' : 'text-gray-300'}`}>
              {remaining}
            </span>
          )}
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
          >
            {loading ? '...' : 'Soltar'}
          </button>
        </div>
      </div>
    </form>
  );
}
