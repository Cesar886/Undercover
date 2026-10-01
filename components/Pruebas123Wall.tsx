'use client';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/apiClient';

type SecretBadge = 'trophy' | 'sparkle';
interface Entry {
  id: string; content: string; created_at: string;
  thread_id?: string | null; alias?: string; verified?: boolean; badge_type?: SecretBadge | null;
}
function Check({ badge }: { badge: SecretBadge }) {
  const trophy = badge === 'trophy';
  return <span role="img" aria-label={trophy ? 'Secreto deepum descubierto' : 'Secreto anónimo descubierto'} title={trophy ? 'Secreto deepum descubierto' : 'Secreto anónimo descubierto'} className="inline-block shrink-0 text-[17px] leading-none">{trophy ? '🏆' : '✨'}</span>;
}
const button = 'rounded-full bg-gradient-to-br from-violet-600 to-violet-800 px-4 py-1.5 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40';
const actionStyle = 'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-stone-400 transition-colors hover:bg-stone-100 hover:text-violet-600 disabled:opacity-40 dark:hover:bg-violet-500/10 dark:hover:text-violet-200';

export function Pruebas123Wall() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [badge, setBadge] = useState<SecretBadge | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const result = await apiGet<{ entries: Entry[]; verified: boolean; badge: SecretBadge | null }>('/api/pruebas123');
    if (result.ok) { setEntries(result.data.entries); setBadge(result.data.badge ?? (result.data.verified ? 'sparkle' : null)); }
    else setError(result.error);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const field = textareaRef.current;
    if (field) { field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px`; }
  }, [content]);

  async function identityAction() {
    if (busy || loading) return;
    setBusy(true); setError(''); setNotice('');
    const result = await apiPost<{ verified: boolean; badge: SecretBadge | null }>('/api/pruebas123', { action: 'reset' });
    if (result.ok) {
      setBadge(result.data.badge ?? (result.data.verified ? 'sparkle' : null));
      setNotice('Nuevo usuario: tu próximo comentario tendrá otro nombre, sin destello.');
    } else setError(result.error);
    setBusy(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || loading || !content.trim()) return;
    setBusy(true); setError(''); setNotice('');
    const result = await apiPost<{ entry: Entry }>('/api/pruebas123', { content: content.trim(), thread_id: thread });
    if (result.ok) { setEntries(current => [result.data.entry, ...current]); setBadge(result.data.entry.badge_type ?? (result.data.entry.verified ? 'sparkle' : null)); setContent(''); }
    else setError(result.error);
    setBusy(false);
  }
  function renderEntry(entry: Entry) {
    return <div className="space-y-2">
      <div className="flex items-center gap-1 text-sm font-bold">
        <span>{entry.alias || `Anónimo ${entry.id.slice(0, 8).toUpperCase()}`}</span>
        {entry.verified && <Check badge={entry.badge_type ?? 'sparkle'} />}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{entry.content}</p>
      <time className="text-xs text-stone-400" dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('es-MX')}</time>
    </div>;
  }
  const selected = entries.find(e => e.id === thread);
  return <main className="mx-auto max-w-[600px] space-y-4 px-4 py-6">
    <Link href="/" className="inline-block text-xs text-stone-400 hover:text-violet-500">← Volver al inicio</Link>
    <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-violet-500/15 dark:bg-[#0d0b1a] dark:shadow-[0_2px_20px_rgba(124,58,237,0.08)]">
      <form onSubmit={submit} aria-busy={busy}>
        <div className="flex gap-3 px-4 pb-3 pt-4">
          <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 shadow-sm ring-2 ring-white dark:bg-violet-500/15 dark:text-violet-200">UM</div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#6b668c]">
              <span>Anónimo</span>{badge && <Check badge={badge} />}
            </div>
            {selected && <div className="mb-2 flex items-start justify-between gap-2 rounded-lg bg-violet-50 p-2 text-xs text-violet-500 dark:bg-violet-500/10">
              <span className="line-clamp-2">Respondiendo a {selected.alias || 'Anónimo'}: {selected.content}</span>
              <button type="button" className="shrink-0 underline" disabled={busy} onClick={() => setThread(null)}>Cancelar</button>
            </div>}
            <textarea ref={textareaRef} aria-label="Comentario" className="w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-300 disabled:opacity-50 dark:text-[#e9e5ff] dark:placeholder:text-[#4a4765]" rows={2} maxLength={500} placeholder={thread ? 'Escribe una respuesta…' : '¿Qué está pasando en la U?'} value={content} disabled={busy || loading} onChange={e => setContent(e.target.value)} />
          </div>
        </div>
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-violet-500/20" />
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2.5 pt-2">
          <button type="button" className={actionStyle} disabled={busy || loading} onClick={() => void identityAction()}><RefreshCw size={14} />Cambiar usuario</button>
          <div className="ml-auto flex items-center gap-2">
            {content.length > 400 && <span className="text-xs tabular-nums text-stone-400">{500 - content.length}</span>}
            <button className={button} disabled={busy || loading || !content.trim()}>{busy ? '…' : thread ? 'Responder' : 'Publicar'}</button>
          </div>
        </div>
      </form>
      {error && <p role="alert" className="px-4 pb-3 text-xs text-red-500">{error}</p>}
      {notice && <p role="status" className="px-4 pb-3 text-xs text-violet-500">{notice}</p>}
    </section>
    {loading ? <p>Cargando…</p> : entries.length === 0 ? <p className="text-center text-sm text-stone-400">Todavía no hay hilos.</p> : entries.filter(e => !e.thread_id).map(entry => <article key={entry.id} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-violet-500/20 dark:bg-[#0d0b1a]">
      {renderEntry(entry)}
      <button className="text-sm font-semibold text-violet-500" disabled={busy} onClick={() => { setThread(entry.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Responder en este hilo</button>
      {entries.filter(e => e.thread_id === entry.id).reverse().map(reply => <div key={reply.id} className="border-l-2 border-violet-200 pl-4 dark:border-violet-500/25">{renderEntry(reply)}</div>)}
    </article>)}
  </main>;
}
