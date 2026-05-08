'use client';
import { useState, useEffect, useRef } from 'react';
import { PostCategory } from '@/types';
import { AuthModal } from '@/components/AuthModal';
import { ImagePicker } from '@/components/ImagePicker';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { colorFor } from '@/lib/avatar';
import { apiPost } from '@/lib/apiClient';

const CATEGORIES: {
  value: PostCategory;
  label: string;
  bg: string;
  border: string;
  text: string;
  glow: string;
  avatarClass: string;
}[] = [
  {
    value: 'general',
    label: 'General',
    bg: 'rgba(100,116,139,0.07)',
    border: '#94a3b8',
    text: '#475569',
    glow: '0 0 0 1px #94a3b840, 0 2px 10px rgba(148,163,184,0.30)',
    avatarClass: 'bg-slate-100 text-slate-600',
  },
  {
    value: 'quemones',
    label: 'Quemones',
    bg: 'rgba(249,115,22,0.07)',
    border: '#f97316',
    text: '#ea580c',
    glow: '0 0 0 1px #f9731630, 0 2px 10px rgba(249,115,22,0.28)',
    avatarClass: 'bg-orange-100 text-orange-600',
  },
  {
    value: 'infieles',
    label: 'Infieles',
    bg: 'rgba(236,72,153,0.07)',
    border: '#ec4899',
    text: '#db2777',
    glow: '0 0 0 1px #ec489930, 0 2px 10px rgba(236,72,153,0.28)',
    avatarClass: 'bg-pink-100 text-pink-600',
  },
  {
    value: 'confesiones',
    label: 'Confesiones',
    bg: 'rgba(147,51,234,0.07)',
    border: '#9333ea',
    text: '#7e22ce',
    glow: '0 0 0 1px #9333ea30, 0 2px 10px rgba(147,51,234,0.28)',
    avatarClass: 'bg-purple-100 text-purple-700',
  },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent]       = useState('');
  const [category, setCategory]     = useState<PostCategory>('general');
  const [loading, setLoading]       = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [username, setUsername]     = useState('');
  const [image, setImage]           = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const { message, showToast }      = useToast();
  const textareaRef                 = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setUsername(data.user?.username ?? ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!username) {
      setShowModal(true);
      return;
    }

    const text = content.trim();
    if (!text && !image) return;

    setLoading(true);
    setImageError(null);
    const result = await apiPost('/api/posts', {
      content: text,
      category,
      image: image ?? undefined,
    });

    if (result.ok) {
      setContent('');
      setImage(null);
      showToast('Publicado');
      onPostCreated();
    } else {
      if (result.status === 401) {
        setShowModal(true);
      } else if (
        result.error.toLowerCase().includes('imagen') ||
        result.error.toLowerCase().includes('formato')
      ) {
        setImageError(result.error);
      } else {
        showToast(result.error);
      }
    }
    setLoading(false);
  }

  const remaining  = MAX_CHARS - content.length;
  const hasContent = content.trim().length > 0 || !!image;
  const isDisabled = loading || (!!username && !hasContent);
  const submitLabel = loading ? '...' : !username ? 'Regístrate' : 'Publicar';

  return (
    <>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden transition-shadow duration-300 hover:shadow-md hover:shadow-gray-100"
        aria-busy={loading}
      >
        {/* Avatar + textarea */}
        <div className="flex gap-3 px-4 pt-4 pb-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs ring-2 ring-white shadow-sm transition-all duration-200 ${
              username ? colorFor(username) : 'bg-gray-100 text-gray-400'
            }`}
          >
            {username ? username.slice(0, 2).toUpperCase() : 'AN'}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-widest uppercase mb-1.5">
              {username || 'Anónimo'}
            </p>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder="¿Qué está pasando en la U?"
              rows={3}
              disabled={loading}
              className="w-full bg-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 text-[15px] leading-relaxed resize-none focus:ring-0 focus:outline-none disabled:opacity-50 overflow-hidden"
            />
            {image && (
              <ImagePicker
                preview={image}
                onPick={(d) => { setImage(d); setImageError(null); }}
                onClear={() => { setImage(null); setImageError(null); }}
                onError={(m) => setImageError(m)}
                disabled={loading}
                uploading={loading && !!image}
              />
            )}
            {imageError && (
              <p className="text-red-500 text-xs mt-1">{imageError}</p>
            )}
          </div>
        </div>

        {/* Gradient divider */}
        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-gray-200 dark:via-slate-700 to-transparent" />

        {/* Bottom bar — siempre dos filas */}
        <div className="px-4 pt-2 pb-2.5 flex flex-col gap-1.5">

          {/* Fila 1: categorías con scroll horizontal */}
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex gap-1.5 w-max">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    style={
                      active
                        ? {
                            backgroundColor: c.bg,
                            borderColor: c.border,
                            color: c.text,
                            boxShadow: c.glow,
                          }
                        : {}
                    }
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold whitespace-nowrap transition-all duration-200 select-none ${
                      active
                        ? ''
                        : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-slate-600 hover:text-gray-500 dark:hover:text-slate-400 hover:bg-gray-50/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fila 2: imagen (izq) — contador + publicar (der) */}
          <div className="flex items-center justify-between">
            <div className="flex-shrink-0">
              <ImagePicker
                preview={null}
                onPick={(d) => { setImage(d); setImageError(null); }}
                onClear={() => { setImage(null); setImageError(null); }}
                onError={(m) => setImageError(m)}
                disabled={loading || !!image}
              />
            </div>

            <div className="flex items-center gap-2.5">
              {remaining < 100 && (
                <span
                  className={`text-xs tabular-nums font-medium transition-colors duration-200 ${
                    remaining < 30 ? 'text-amber-500' : 'text-gray-300'
                  }`}
                >
                  {remaining}
                </span>
              )}
              <button
                type="submit"
                disabled={isDisabled}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                  isDisabled
                    ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm hover:shadow-md hover:shadow-orange-200/70 hover:scale-[1.03] active:scale-[0.97]'
                }`}
              >
                {submitLabel}
              </button>
            </div>
          </div>

        </div>
      </form>

      <Toast message={message} />
    </>
  );
}
