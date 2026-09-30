'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/apiClient';

interface Entry {
  id: string; content: string; created_at: string;
  thread_id?: string | null; alias?: string; verified?: boolean;
}
function Check() {
  return <BadgeCheck size={19} fill="#1d9bf0" color="white" aria-label="Verificado" className="inline-block shrink-0" />;
}
const button = 'rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40';
const inputStyle = 'w-full rounded-xl border border-stone-200 bg-transparent p-3 text-sm dark:border-violet-500/25';

export function Pruebas123Wall() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [content, setContent] = useState('');
  const [secret, setSecret] = useState('');
  const [verified, setVerified] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const result = await apiGet<{ entries: Entry[]; verified: boolean }>('/api/pruebas123');
    if (result.ok) { setEntries(result.data.entries); setVerified(result.data.verified); }
    else setError(result.error);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function identityAction(action: 'verify' | 'reset') {
    if (busy || loading) return;
    setBusy(true); setError(''); setNotice('');
    const result = await apiPost<{ verified: boolean }>('/api/pruebas123', { action, secret });
    if (result.ok) {
      setVerified(result.data.verified); setSecret('');
      setNotice(action === 'reset' ? 'Nuevo usuario: tu próximo comentario tendrá otro nombre, sin palomita.' : 'Palomita activada para tus próximos comentarios.');
    } else setError(result.error);
    setBusy(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || loading || !content.trim()) return;
    setBusy(true); setError(''); setNotice('');
    const result = await apiPost<{ entry: Entry }>('/api/pruebas123', { content: content.trim(), thread_id: thread });
    if (result.ok) { setEntries(current => [result.data.entry, ...current]); setContent(''); }
    else setError(result.error);
    setBusy(false);
  }
  function renderEntry(entry: Entry) {
    return <div className="space-y-2">
      <div className="flex items-center gap-1 text-sm font-bold">
        <span>{entry.alias || `Anónimo ${entry.id.slice(0, 8).toUpperCase()}`}</span>
        {entry.verified && <Check />}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{entry.content}</p>
      <time className="text-xs text-stone-400" dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('es-MX')}</time>
    </div>;
  }
  const selected = entries.find(e => e.id === thread);
  return <main className="mx-auto max-w-[720px] space-y-5 px-4 py-7">
    <Link href="/" className="text-sm text-violet-500">← Volver al inicio</Link>
    <section className="space-y-5 rounded-3xl border border-violet-200 bg-white p-5 dark:border-violet-500/20 dark:bg-[#0d0b1a] sm:p-7">
      <header><h1 className="font-display text-2xl font-semibold">Pruebas 123</h1>
        <p className="mt-2 text-sm text-stone-500">Lo que escribes aquí permanece en este espacio, fuera del feed y del panel administrativo.</p>
      </header>
      <div className="space-y-3 rounded-2xl bg-violet-50 p-4 dark:bg-violet-500/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-sm font-semibold">{verified ? 'Usuario verificado' : 'Usuario anónimo'}{verified && <Check />}</span>
          <button className={button} disabled={busy || loading} onClick={() => void identityAction('reset')}><RefreshCw size={14} className="mr-2 inline" />Cambiar usuario</button>
        </div>
        <p className="text-xs text-stone-500">Tu nombre se conserva dentro del hilo y cambia en cada hilo nuevo.</p>
        {!verified && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void identityAction('verify'); }}>
          <input type="password" aria-label="Palabra secreta" placeholder="Palabra secreta" autoComplete="off" className={inputStyle} value={secret} onChange={e => setSecret(e.target.value)} disabled={busy || loading} />
          <button className={button} disabled={busy || loading || !secret}>Activar</button>
        </form>}
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {notice && <p role="status" className="text-sm text-violet-500">{notice}</p>}
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{selected ? `Responder a ${selected.alias || 'Anónimo'}` : 'Nuevo hilo'}</h2>
          {thread && <button type="button" className="text-sm text-violet-500" disabled={busy} onClick={() => setThread(null)}>Cancelar respuesta</button>}
        </div>
        {selected && <p className="line-clamp-2 text-xs text-stone-500">{selected.content}</p>}
        <textarea aria-label="Comentario" className={inputStyle} rows={3} maxLength={500} placeholder="Escribe aquí…" value={content} disabled={busy || loading} onChange={e => setContent(e.target.value)} />
        <div className="flex items-center justify-between"><span className="text-xs text-stone-400">{content.length}/500</span><button className={button} disabled={busy || loading || !content.trim()}>{busy ? 'Guardando…' : thread ? 'Responder' : 'Crear hilo'}</button></div>
      </form>
    </section>
    {loading ? <p>Cargando…</p> : entries.length === 0 ? <p className="text-center text-sm text-stone-400">Todavía no hay hilos.</p> : entries.filter(e => !e.thread_id).map(entry => <article key={entry.id} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-violet-500/20 dark:bg-[#0d0b1a]">
      {renderEntry(entry)}
      <button className="text-sm font-semibold text-violet-500" disabled={busy} onClick={() => { setThread(entry.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Responder en este hilo</button>
      {entries.filter(e => e.thread_id === entry.id).reverse().map(reply => <div key={reply.id} className="border-l-2 border-violet-200 pl-4 dark:border-violet-500/25">{renderEntry(reply)}</div>)}
    </article>)}
  </main>;
}
