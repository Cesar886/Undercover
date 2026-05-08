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
  activeClass: string;
  avatarClass: string;
}[] = [
  { value: 'quemones',    label: 'Quemones',    activeClass: 'bg-orange-500/10 border-orange-500 text-orange-600', avatarClass: 'bg-orange-100 text-orange-600' },
  { value: 'infieles',    label: 'Infieles',    activeClass: 'bg-pink-500/10 border-pink-500 text-pink-600',       avatarClass: 'bg-pink-100 text-pink-600' },
  { value: 'confesiones', label: 'Confesiones', activeClass: 'bg-purple-600/10 border-purple-600 text-purple-700', avatarClass: 'bg-purple-100 text-purple-700' },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent]       = useState('');
  const [category, setCategory]     = useState<PostCategory>('quemones');
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

  // Auto-resize textarea to content height
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
  // Only disable for logged-in users with no content; guests always see active CTA
  const isDisabled = loading || (!!username && !hasContent);
  const submitLabel = loading ? '...' : !username ? 'Regístrate' : 'Publicar';

  return (
    <>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
        aria-busy={loading}
      >
        {/* Avatar + textarea */}
        <div className="flex gap-3 px-4 pt-4 pb-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs ${username ? colorFor(username) : 'bg-gray-100 text-gray-400'}`}>
            {username ? username.slice(0, 2).toUpperCase() : 'AN'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-600 font-medium mb-1.5">
              {username || 'Anónimo'}
            </p>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder="¿Qué está pasando en la U?"
              rows={3}
              disabled={loading}
              className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 text-[15px] leading-relaxed resize-none focus:ring-0 focus:outline-none disabled:opacity-60 overflow-hidden"
            />
            {/* Image preview lives here when image is selected */}
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
            {imageError && <p className="text-red-500 text-xs mt-1">{imageError}</p>}
          </div>
        </div>

        {/* Bottom bar: [📷 + categories] | [contador + botón] */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
          <div className="flex items-center gap-2.5">
            {/* Image trigger moves here when no image is selected */}
            {!image && (
              <ImagePicker
                preview={null}
                onPick={(d) => { setImage(d); setImageError(null); }}
                onClear={() => { setImage(null); setImageError(null); }}
                onError={(m) => setImageError(m)}
                disabled={loading}
              />
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest leading-none">
                Categoría
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-all duration-150 ${
                      category === c.value
                        ? c.activeClass
                        : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            {remaining < 100 && (
              <span className={`text-xs tabular-nums ${remaining < 30 ? 'text-amber-500' : 'text-gray-300'}`}>
                {remaining}
              </span>
            )}
            <button
              type="submit"
              disabled={isDisabled}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                isDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow-md hover:shadow-orange-200'
              }`}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </form>

      <Toast message={message} />
    </>
  );
}
