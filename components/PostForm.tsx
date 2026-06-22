'use client';
import { useState, useEffect, useRef } from 'react';
import { BarChart3, Plus, X } from 'lucide-react';
import { PostCategory } from '@/types';
import { ImagePicker } from '@/components/ImagePicker';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { AnonAvatar } from '@/components/AnonAvatar';
import { apiPost } from '@/lib/apiClient';
import { useAnonId } from '@/hooks/useAnonId';
import { containsUrl } from '@/lib/linkDetection';

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
  {
    value: 'stickers',
    label: 'Stickers',
    bg: 'rgba(234,179,8,0.07)',
    border: '#eab308',
    text: '#ca8a04',
    glow: '0 0 0 1px #eab30830, 0 2px 10px rgba(234,179,8,0.28)',
  },
];

const MAX_CHARS = 500;
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 6;
const MAX_POLL_OPTION_CHARS = 80;

function cleanPollOptions(options: string[]): string[] {
  return options.map((option) => option.trim()).filter(Boolean);
}

function hasDuplicatePollOptions(options: string[]): boolean {
  const normalized = options.map((option) => option.toLocaleLowerCase('es-MX'));
  return new Set(normalized).size !== normalized.length;
}

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
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const { message, showToast }  = useToast();
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const { anonId, displayName } = useAnonId();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  useEffect(() => {
    if (category === 'stickers') {
      setPollEnabled(false);
      setContent('');
    }
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const text = content.trim();
    if (!text && !image) return;
    if (containsUrl(text)) {
      showToast('No se permiten enlaces ni URLs.');
      return;
    }

    const cleanedPollOptions = pollEnabled ? cleanPollOptions(pollOptions) : [];
    if (pollEnabled) {
      if (cleanedPollOptions.length < MIN_POLL_OPTIONS) {
        showToast('La encuesta necesita al menos 2 opciones.');
        return;
      }
      if (cleanedPollOptions.length > MAX_POLL_OPTIONS) {
        showToast(`La encuesta permite máximo ${MAX_POLL_OPTIONS} opciones.`);
        return;
      }
      if (cleanedPollOptions.some((option) => containsUrl(option))) {
        showToast('No se permiten enlaces ni URLs en la encuesta.');
        return;
      }
      if (hasDuplicatePollOptions(cleanedPollOptions)) {
        showToast('Las opciones no pueden repetirse.');
        return;
      }
    }

    setLoading(true);
    setImageError(null);
    const result = await apiPost('/api/posts', {
      content: text,
      category,
      image: image ?? undefined,
      poll_options: pollEnabled ? cleanedPollOptions : undefined,
      poll_question: pollEnabled ? text : undefined,
    });

    if (result.ok) {
      setContent('');
      setImage(null);
      setPollEnabled(false);
      setPollOptions(['', '']);
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

  function updatePollOption(index: number, value: string) {
    setPollOptions((current) =>
      current.map((option, i) => i === index ? value.slice(0, MAX_POLL_OPTION_CHARS) : option)
    );
  }

  function addPollOption() {
    setPollOptions((current) =>
      current.length >= MAX_POLL_OPTIONS ? current : [...current, '']
    );
  }

  function removePollOption(index: number) {
    setPollOptions((current) =>
      current.length <= MIN_POLL_OPTIONS ? current : current.filter((_, i) => i !== index)
    );
  }

  const remaining  = MAX_CHARS - content.length;
  const hasContent = content.trim().length > 0 || !!image;
  const hasBlockedUrl = containsUrl(content);
  const cleanedPollOptions = pollEnabled ? cleanPollOptions(pollOptions) : [];
  const pollHasUrl = pollEnabled && pollOptions.some((option) => containsUrl(option));
  const pollHasDuplicates = pollEnabled && hasDuplicatePollOptions(cleanedPollOptions);
  const pollIsIncomplete = pollEnabled && cleanedPollOptions.length < MIN_POLL_OPTIONS;
  const isDisabled = loading || !hasContent || hasBlockedUrl || pollHasUrl || pollHasDuplicates || pollIsIncomplete;

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
            {category !== 'stickers' && (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
                placeholder={pollEnabled ? '¿Cuál es tu pregunta?' : '¿Qué está pasando en la U?'}
                rows={2}
                disabled={loading}
                className="w-full bg-transparent text-zinc-800 dark:text-[#e9e5ff] placeholder:text-zinc-300 dark:placeholder:text-[#2e2b4a] text-[15px] leading-relaxed resize-none focus:ring-0 focus:outline-none disabled:opacity-50 overflow-hidden"
              />
            )}
            {category === 'stickers' && !image && (
              <p className="text-stone-400 dark:text-[#6b6a8f] text-[15px] italic py-2">
                Sube una imagen para tu sticker...
              </p>
            )}
            {hasBlockedUrl && category !== 'stickers' && (
              <p className="text-red-500 text-xs mt-1">No se permiten enlaces ni URLs.</p>
            )}
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

            {pollEnabled && (
              <div className="mt-3 space-y-1.5 border-l-2 border-violet-200 pl-3 dark:border-violet-500/30">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span className="w-4 shrink-0 text-center text-[10px] font-bold tabular-nums text-stone-300 dark:text-[#4a4870]">
                      {index + 1}
                    </span>
                    <input
                      value={option}
                      onChange={(event) => updatePollOption(index, event.target.value)}
                      placeholder={`Opción ${index + 1}`}
                      disabled={loading}
                      maxLength={MAX_POLL_OPTION_CHARS}
                      className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[13px] text-stone-700 placeholder-stone-300 outline-none transition-colors focus:border-violet-400 dark:border-violet-500/15 dark:bg-[#0d0b1a]/80 dark:text-[#e9e5ff] dark:placeholder-[#4a4870] dark:focus:border-violet-500"
                    />
                    {pollOptions.length > MIN_POLL_OPTIONS && (
                      <button
                        type="button"
                        onClick={() => removePollOption(index)}
                        disabled={loading}
                        className="shrink-0 rounded-full p-1 text-stone-300 transition-colors hover:text-red-400 disabled:opacity-50 dark:text-[#4a4870] dark:hover:text-red-400"
                        aria-label="Quitar opción"
                      >
                        <X size={13} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                ))}

                {pollOptions.length < MAX_POLL_OPTIONS && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 shrink-0" />
                    <button
                      type="button"
                      onClick={addPollOption}
                      disabled={loading}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-400 transition-colors hover:text-violet-600 disabled:opacity-50 dark:text-violet-400/60 dark:hover:text-violet-300"
                    >
                      <Plus size={11} strokeWidth={2} />
                      Agregar opción
                    </button>
                  </div>
                )}

                {pollHasUrl && (
                  <p className="pl-6 text-[11px] text-red-500">No se permiten enlaces ni URLs.</p>
                )}
                {pollHasDuplicates && (
                  <p className="pl-6 text-[11px] text-red-500">Las opciones no pueden repetirse.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-gray-200 dark:via-violet-500/20 to-transparent" />

        <div className="px-4 pt-2 pb-2.5 flex items-center gap-2">
          {/* Acciones: imagen + encuesta */}
          <div className="flex items-center gap-1">
            <ImagePicker
              preview={null}
              onPick={(d) => { setImage(d); setImageError(null); }}
              onClear={() => { setImage(null); setImageError(null); }}
              onError={(m) => setImageError(m)}
              disabled={loading || !!image}
            />
            {category !== 'stickers' && (
              <button
                type="button"
                onClick={() => setPollEnabled((enabled) => !enabled)}
                disabled={loading}
                aria-pressed={pollEnabled}
                title="Encuesta"
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                  pollEnabled
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-200/60 dark:shadow-violet-900/30'
                    : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-[#4a4870] dark:hover:bg-violet-500/10 dark:hover:text-violet-200'
                }`}
              >
                <BarChart3 size={14} strokeWidth={1.8} />
                Encuesta
              </button>
            )}
          </div>

          {/* Categorías */}
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

          {/* Contador + Publicar */}
          <div className="flex shrink-0 items-center gap-2 ml-auto">
            {remaining < 100 && (
              <span
                className={`text-xs tabular-nums font-medium transition-colors duration-200 ${
                  remaining < 30 ? 'text-red-400' : 'text-gray-300 dark:text-[#3a3860]'
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
                  : 'bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-sm dark:shadow-[0_0_16px_rgba(124,58,237,0.35)] hover:shadow-md hover:shadow-violet-200/50 dark:hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:scale-[1.03] active:scale-[0.97]'
              }`}
            >
              {loading ? '...' : 'Publicar'}
            </button>
          </div>
        </div>
      </form>

      <Toast message={message} />
    </>
  );
}
