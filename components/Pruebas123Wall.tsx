'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Beaker, Loader2, LockKeyhole, Send } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/apiClient';

interface PruebaEntry {
  id: string;
  content: string;
  created_at: string;
}

const MAX_CHARS = 500;

export function Pruebas123Wall() {
  const [entries, setEntries] = useState<PruebaEntry[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const result = await apiGet<{ entries: PruebaEntry[] }>('/api/pruebas123');
    if (result.ok) {
      setEntries(result.data.entries ?? []);
      setError('');
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    setError('');
    const result = await apiPost<{ entry: PruebaEntry }>('/api/pruebas123', { content: text });
    if (result.ok) {
      setEntries((current) => [result.data.entry, ...current].slice(0, 100));
      setContent('');
    } else {
      setError(result.error);
    }
    setSending(false);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-[680px] px-4 py-7">
      <Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-stone-400 transition-colors hover:text-violet-600 dark:hover:text-violet-300">
        <ArrowLeft size={14} /> Volver al inicio
      </Link>

      <section className="overflow-hidden rounded-[26px] border border-violet-100 bg-white shadow-[0_18px_55px_rgba(76,29,149,0.08)] dark:border-violet-500/15 dark:bg-[#0d0b1a]">
        <header className="border-b border-violet-100 bg-gradient-to-br from-violet-50 to-white px-5 py-6 dark:border-violet-500/10 dark:from-violet-950/30 dark:to-[#0d0b1a] sm:px-7">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
              <Beaker size={21} />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold text-stone-900 dark:text-violet-50">Pruebas 123</h1>
              <p className="mt-1 text-sm leading-6 text-stone-500 dark:text-[#8f89ad]">
                Espacio aislado. Lo publicado aqui solamente aparece en esta pantalla.
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                <LockKeyhole size={11} /> Fuera del feed y del panel admin
              </p>
            </div>
          </div>
        </header>

        <form onSubmit={submit} className="border-b border-stone-100 p-5 dark:border-violet-500/10 sm:p-7">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value.slice(0, MAX_CHARS))}
            placeholder="Escribe algo para probar..."
            rows={4}
            disabled={sending}
            maxLength={MAX_CHARS}
            className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-60 dark:border-violet-500/15 dark:bg-white/[0.025] dark:text-violet-50 dark:placeholder:text-[#4a4765] dark:focus:border-violet-500 dark:focus:ring-violet-500/10"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[11px] tabular-nums text-stone-400">{content.length}/{MAX_CHARS}</span>
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Publicar aqui
            </button>
          </div>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        </form>

        <div className="divide-y divide-stone-100 dark:divide-violet-500/10">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-stone-400">
              <Loader2 size={17} className="animate-spin" /> Cargando pruebas...
            </div>
          ) : entries.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm font-medium text-stone-500 dark:text-[#8f89ad]">Todavia no hay nada aqui.</p>
              <p className="mt-1 text-xs text-stone-400 dark:text-[#4a4765]">Lo primero que publiques permanecera dentro de esta pantalla.</p>
            </div>
          ) : entries.map((entry) => (
            <article key={entry.id} className="px-5 py-4 sm:px-7">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-700 dark:text-[#d7d2ee]">{entry.content}</p>
              <time className="mt-2 block text-[10px] text-stone-400" dateTime={entry.created_at}>
                {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}
              </time>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
