'use client';
import { useState, useEffect, useRef } from 'react';
import { PostCategory } from '@/types';
import { ImagePicker } from '@/components/ImagePicker';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { AnonAvatar } from '@/components/AnonAvatar';
import { apiPost } from '@/lib/apiClient';
import { useAnonId } from '@/hooks/useAnonId';

const CATEGORIES: {
  value: PostCategory;
  label: string;
  bg: string;
  border: string;
  text: string;
  glow: string;
}[] = [
  {
    value: 'general',
    label: 'General',
    bg: 'rgba(100,116,139,0.07)',
    border: '#94a3b8',
    text: '#475569',
    glow: '0 0 0 1px #94a3b840, 0 2px 10px rgba(148,163,184,0.30)',
  },
  {
    value: 'quemones',
    label: 'Quemones',
    bg: 'rgba(249,115,22,0.07)',
    border: '#f97316',
    text: '#ea580c',
    glow: '0 0 0 1px #f9731630, 0 2px 10px rgba(249,115,22,0.28)',
  },
  {
    value: 'infieles',
    label: 'Infieles',
    bg: 'rgba(236,72,153,0.07)',
    border: '#ec4899',
    text: '#db2777',
    glow: '0 0 0 1px #ec489930, 0 2px 10px rgba(236,72,153,0.28)',
  },
  {
    value: 'confesiones',
    label: 'Confesiones',
    bg: 'rgba(147,51,234,0.07)',
    border: '#9333ea',
    text: '#7e22ce',
    glow: '0 0 0 1px #9333ea30, 0 2px 10px rgba(147,51,234,0.28)',
  },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
  defaultCategory?: PostCategory;
  lockedCategory?: boolean;
}

export function PostForm({ onPostCreated, defaultCategory = 'general', lockedCategory = false }: PostFormProps) {
  const [content, setContent]   = useState('');
  const [category, setCategory] = useState<PostCategory>(defaultCategory);
  const [loading, setLoading]   = useState(false);
  const [image, setImage]       = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const { message, showToast }  = useToast();
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const { anonId, displayName } = useAnonId();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

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
    } else if (
      result.error.toLowerCase().includes('imagen') ||
      result.error.toLowerCase().includes('formato')
    ) {
      setImageError(result.error);
    } else {
      showToast(result.error);
    }
    setLoading(false);
  }

  const remaining  = MAX_CHARS - content.length;
  const hasContent = content.trim().length > 0 || !!image;
  const isDisabled = loading || !hasContent;

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#0d0b1a] border border-gray-200/80 dark:border-violet-500/15 rounded-2xl shadow-sm dark:shadow-[0_2px_20px_rgba(124,58,237,0.08)] overflow-hidden transition-shadow duration-300 hover:shadow-md hover:shadow-gray-100 dark:hover:shadow-[0_4px_28px_rgba(124,58,237,0.14)] dark:hover:border-violet-500/25"
        aria-busy={loading}
      >
        <div className="flex gap-3 px-4 pt-4 pb-3">
          <AnonAvatar
            name={anonId || 'AN'}
            size={36}
            className="ring-2 ring-white shadow-sm flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-zinc-400 dark:text-[#4a4870] font-semibold tracking-widest uppercase mb-1.5 font-mono">
              {displayName}
            </p>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder="¿Qué está pasando en la U?"
              rows={2}
              disabled={loading}
              className="w-full bg-transparent text-zinc-800 dark:text-[#e9e5ff] placeholder:text-zinc-300 dark:placeholder:text-[#2e2b4a] text-[15px] leading-relaxed resize-none focus:ring-0 focus:outline-none disabled:opacity-50 overflow-hidden"
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

        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-gray-200 dark:via-violet-500/20 to-transparent" />

        <div className="px-4 pt-2 pb-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5">
          {!lockedCategory && (
            <div className="overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
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
                          : 'border-gray-200 dark:border-violet-500/20 text-gray-400 dark:text-[#4a4870] hover:border-gray-300 dark:hover:border-violet-400/40 hover:text-gray-500 dark:hover:text-violet-300 hover:bg-gray-50/80 dark:hover:bg-violet-500/10'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between sm:justify-start sm:flex-shrink-0 sm:gap-2">
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
                    remaining < 30 ? 'text-mauve-500' : 'text-gray-300'
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
                    ? 'bg-gray-100 dark:bg-violet-900/20 text-gray-400 dark:text-[#3a3860] cursor-not-allowed'
                    : 'bg-gradient-to-br from-violet-600 to-violet-800 dark:from-violet-600 dark:to-violet-800 text-white shadow-sm dark:shadow-[0_0_16px_rgba(124,58,237,0.35)] hover:shadow-md hover:shadow-violet-200/50 dark:hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:scale-[1.03] active:scale-[0.97]'
                }`}
              >
                {loading ? '...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </form>

      <Toast message={message} />
    </>
  );
}
