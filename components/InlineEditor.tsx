'use client';
import { useEffect, useRef, useState } from 'react';

interface InlineEditorProps {
  initial: string;
  maxChars: number;
  onCancel: () => void;
  onSave: (content: string) => Promise<void> | void;
  saving?: boolean;
  textareaClassName?: string;
}

export function InlineEditor({
  initial,
  maxChars,
  onCancel,
  onSave,
  saving = false,
  textareaClassName,
}: InlineEditorProps) {
  const [content, setContent] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const remaining = maxChars - content.length;
  const trimmed = content.trim();
  const dirty = trimmed !== initial.trim();
  const canSave = !!trimmed && dirty && !saving;

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canSave) onSave(trimmed);
    }
  }

  return (
    <div className="w-full">
      <textarea
        ref={ref}
        value={content}
        onChange={(e) => {
          setContent(e.target.value.slice(0, maxChars));
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }}
        onKeyDown={handleKey}
        disabled={saving}
        rows={1}
        className={
          textareaClassName ??
          'w-full text-[15px] text-stone-800 dark:text-slate-200 placeholder-stone-300 dark:placeholder-slate-600 bg-transparent dark:bg-slate-800 resize-none overflow-hidden focus:outline-none border border-stone-200 dark:border-slate-700 focus:border-orange-400 rounded-lg px-3 py-2 leading-relaxed disabled:opacity-60'
        }
      />
      <div className="flex items-center justify-between mt-2">
        <span className={`text-[11px] tabular-nums ${remaining < 20 ? 'text-amber-600' : 'text-stone-400'}`}>
          {remaining}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-stone-400 dark:text-slate-500 hover:text-stone-700 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(trimmed)}
            className="px-4 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 active:scale-95 disabled:opacity-30 text-white rounded-full transition-all shadow-sm"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
