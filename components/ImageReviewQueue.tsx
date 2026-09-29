'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  EyeOff,
  Image as ImageIcon,
  Inbox,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

const ADMIN = '/imagenes-dnewjlfe99474ef8wu-admin';
type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden';
type Filter = 'all' | ReviewStatus;
type Counts = Record<Filter, number>;

interface Review {
  id: string;
  created_at: string;
  reviewed_at: string | null;
  kind: 'post' | 'comment';
  content: string;
  status: ReviewStatus;
  has_image: boolean;
  metadata: Record<string, unknown>;
}

const STATUS_META: Record<ReviewStatus, { label: string; badge: string }> = {
  pending: { label: 'Pendiente', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' },
  approved: { label: 'Aprobada', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' },
  rejected: { label: 'Rechazada', badge: 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300' },
  hidden: { label: 'Oculta', badge: 'bg-stone-200 text-stone-700 dark:bg-white/10 dark:text-stone-300' },
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'hidden', label: 'Ocultas' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function ReviewSkeleton() {
  return <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white dark:border-violet-400/10 dark:bg-white/[0.025]">
    <div className="aspect-[4/3] animate-pulse bg-stone-100 dark:bg-violet-500/[0.06]" />
    <div className="space-y-3 p-4"><div className="h-3 w-28 animate-pulse rounded-full bg-stone-100 dark:bg-violet-500/10" /><div className="h-4 w-full animate-pulse rounded-full bg-stone-100 dark:bg-violet-500/10" /><div className="h-10 w-full animate-pulse rounded-xl bg-stone-100 dark:bg-violet-500/10" /></div>
  </div>;
}

export function ImageReviewQueue({ embedded = false }: { embedded?: boolean }) {
  const [images, setImages] = useState<Review[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, pending: 0, approved: 0, rejected: 0, hidden: 0 });
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), status: filter });
      const res = await fetch('/api/image-admin?' + params.toString(), { cache: 'no-store' });
      if (res.status === 401) { window.location.replace(ADMIN + '/login'); return; }
      if (!res.ok) throw new Error();
      const data = await res.json() as { images: Review[]; hasMore: boolean; counts: Counts };
      setImages(data.images);
      setExpanded({});
      setHasMore(data.hasMore);
      setCounts(data.counts);
      if (!data.images.length && page > 1) setPage((current) => current - 1);
    } catch {
      setError('No se pudo cargar el historial. Intenta actualizar.');
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  async function review(item: Review, decision: Exclude<ReviewStatus, 'pending'>) {
    setBusy(item.id); setError(''); setNotice('');
    try {
      const res = await fetch('/api/image-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, decision }),
      });
      if (res.status === 401) { window.location.replace(ADMIN + '/login'); return; }
      if (!res.ok) {
        const response = await res.json().catch(() => null) as { error?: string } | null;
        setError(response?.error ?? 'No se pudo guardar la decisión.');
        return;
      }
      const result = await res.json() as { publicVisible?: boolean };
      setCounts((current) => ({
        ...current,
        [item.status]: Math.max(0, current[item.status] - 1),
        [decision]: current[decision] + 1,
      }));
      setImages((current) => filter === 'all'
        ? current.map((image) => image.id === item.id ? { ...image, status: decision, reviewed_at: new Date().toISOString() } : image)
        : current.filter((image) => image.id !== item.id));
      setNotice(decision === 'approved'
        ? result.publicVisible
          ? (item.status === 'hidden' ? 'Imagen desocultada y visible nuevamente.' : 'Imagen aprobada y visible.')
          : 'Imagen aprobada en el archivo privado. Su publicación no está disponible para mostrarla.'
        : decision === 'rejected' ? 'Imagen marcada como rechazada.' : 'Imagen oculta; puedes desocultarla desde este panel.');
    } catch {
      setError('No se pudo guardar la decisión. Intenta nuevamente.');
    } finally { setBusy(null); }
  }

  async function removeImage(item: Review) {
    if (item.status !== 'approved' && item.status !== 'rejected') return;
    setBusy(item.id); setError(''); setNotice('');
    try {
      const res = await fetch('/api/image-admin?id=' + encodeURIComponent(item.id), { method: 'DELETE' });
      if (res.status === 401) { window.location.replace(ADMIN + '/login'); return; }
      if (!res.ok) {
        const response = await res.json().catch(() => null) as { error?: string } | null;
        setError(response?.error ?? 'No se pudo eliminar la imagen.');
        return;
      }
      setCounts((current) => ({
        ...current,
        all: Math.max(0, current.all - 1),
        [item.status]: Math.max(0, current[item.status] - 1),
      }));
      setImages((current) => current.filter((image) => image.id !== item.id));
      setExpanded((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setNotice('Imagen eliminada de la base de datos y del servidor.');
      setDeleteTarget(null);
    } catch {
      setError('No se pudo eliminar la imagen. Intenta nuevamente.');
    } finally { setBusy(null); }
  }

  async function logout() {
    setError('');
    try {
      const res = await fetch('/api/image-admin/session', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      window.location.replace(ADMIN + '/login');
    } catch { setError('No se pudo cerrar la sesión. Intenta nuevamente.'); }
  }

  return <div className={embedded ? 'relative min-h-[560px]' : 'relative isolate min-h-[70vh] overflow-hidden px-4 py-8 sm:py-12'}>
    <ConfirmDialog
      open={!!deleteTarget}
      title="Eliminar imagen permanentemente"
      description="Esta acción eliminará la imagen de la base de datos y del servidor. No se puede deshacer."
      confirmLabel="Eliminar permanentemente"
      cancelLabel="Cancelar"
      destructive
      busy={!!deleteTarget && busy === deleteTarget.id}
      onConfirm={() => { if (deleteTarget) void removeImage(deleteTarget); }}
      onCancel={() => { if (!busy) setDeleteTarget(null); }}
    />
    {!embedded && <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.12),transparent_65%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.18),transparent_65%)]" />}
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-[0_16px_50px_rgba(60,42,86,0.08)] dark:border-violet-400/15 dark:bg-[#0b0916]">
        <div className="relative flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mauve-600 to-violet-700 text-white"><ShieldCheck size={23} /></div>
          <div className="flex items-center gap-2 pl-16 sm:pl-0">
            <button onClick={() => void load()} disabled={loading || !!busy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 px-3.5 text-xs font-semibold text-stone-600 disabled:opacity-50 dark:border-violet-400/15 dark:text-[#a7a1c2]"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Actualizar</button>
            {!embedded && <button onClick={logout} disabled={!!busy} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-stone-400 hover:text-red-600 dark:text-[#5f5b80]"><LogOut size={15} />Salir</button>}
          </div>
        </div>
        <div className="grid border-t border-black/[0.05] bg-stone-50/60 dark:border-violet-400/10 dark:bg-white/[0.018] sm:grid-cols-3">
          <div className="flex items-center gap-3 px-5 py-4 sm:px-7"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300"><ImageIcon size={17} /></span><div><p className="text-xl font-bold text-stone-900 dark:text-[#ece8ff]">{counts.all}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Imágenes guardadas</p></div></div>
          <div className="flex items-center gap-3 border-t border-black/[0.05] px-5 py-4 dark:border-violet-400/10 sm:border-l sm:border-t-0 sm:px-7"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"><Inbox size={17} /></span><div><p className="text-xl font-bold text-stone-900 dark:text-[#ece8ff]">{counts.pending}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Pendientes</p></div></div>
          <div className="flex items-center gap-3 border-t border-black/[0.05] px-5 py-4 dark:border-violet-400/10 sm:border-l sm:border-t-0 sm:px-7"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><Check size={17} /></span><div><p className="text-xl font-bold text-stone-900 dark:text-[#ece8ff]">{counts.approved}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Aprobadas</p></div></div>
        </div>
      </header>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map((option) => <button key={option.value} onClick={() => changeFilter(option.value)} className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${filter === option.value ? 'border-violet-600 bg-violet-600 text-white' : 'border-stone-200 bg-white text-stone-500 hover:border-violet-300 dark:border-violet-400/15 dark:bg-white/[0.025] dark:text-[#777294]'}`}>{option.label}<span className={`ml-1.5 ${filter === option.value ? 'text-white/70' : 'text-stone-400'}`}>{counts[option.value]}</span></button>)}
      </div>

      {error && <div role="alert" className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/15 dark:bg-red-400/[0.08] dark:text-red-300"><AlertCircle size={17} />{error}</div>}
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-700 shadow-xl dark:border-emerald-400/20 dark:bg-[#151125] dark:text-emerald-300"><Check size={15} />{notice}</div>}

      {loading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <ReviewSkeleton key={index} />)}</div> : images.length === 0 ?
        <section className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-200 bg-white/70 px-6 text-center dark:border-violet-400/15 dark:bg-white/[0.018]"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300"><Inbox size={25} /></div><h2 className="font-display text-xl font-semibold dark:text-[#ece8ff]">No hay imágenes en este estado</h2><p className="mt-2 text-sm text-stone-500 dark:text-[#777294]">Cambia de filtro o actualiza el historial.</p></section> :
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{images.map((item) => {
          const meta = STATUS_META[item.status]; const itemBusy = busy === item.id;
          const metadataEntries = Object.entries(item.metadata ?? {});
          return <article key={item.id} className="group overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_8px_30px_rgba(60,42,86,0.06)] dark:border-violet-400/10 dark:bg-[#0c0a17]">
            <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,#f5f3f7,#ebe7ef)] dark:bg-[linear-gradient(135deg,#100d1d,#171126)]">
              {item.has_image ? <img src={'/api/image-admin/' + item.id} alt="Imagen de moderación" loading="lazy" className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-400"><ImageIcon size={30} /><span className="text-xs">Archivo anterior no disponible</span></div>}
              <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}>{meta.label}</span>
              <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-mauve-700 dark:bg-[#0b0916]/85 dark:text-violet-300">{item.kind === 'post' ? 'Publicación' : 'Comentario'}</span>
              {itemBusy && <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-[#080611]/75"><span className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold shadow-lg dark:bg-[#171126]"><Loader2 size={15} className="animate-spin" />Procesando…</span></div>}
            </div>
            <div className="p-4"><p className="mb-1 text-[10px] font-medium text-stone-400">Enviada {formatDate(item.created_at)}</p>{item.reviewed_at && <p className="mb-3 text-[10px] text-stone-400">Última revisión {formatDate(item.reviewed_at)}</p>}<p className="mb-4 min-h-[40px] line-clamp-2 text-sm leading-5 text-stone-600 dark:text-[#aaa4c4]">{item.content || <span className="italic text-stone-400">Sin texto asociado</span>}</p>
              <div className="grid grid-cols-3 gap-2">
                {item.status !== 'approved' && <button disabled={!!busy || !item.has_image} onClick={() => review(item, 'approved')} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-emerald-600 text-[11px] font-bold text-white disabled:opacity-40"><Check size={14} />{item.status === 'hidden' ? 'Desocultar' : 'Aprobar'}</button>}
                {item.status !== 'rejected' && <button disabled={!!busy} onClick={() => review(item, 'rejected')} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-red-50 text-[11px] font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300"><X size={14} />Rechazar</button>}
                {item.status !== 'hidden' && <button disabled={!!busy} onClick={() => review(item, 'hidden')} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-stone-100 text-[11px] font-bold text-stone-600 dark:bg-white/10 dark:text-stone-300"><EyeOff size={14} />Ocultar</button>}
                {(item.status === 'approved' || item.status === 'rejected') && <button disabled={!!busy} onClick={() => setDeleteTarget(item)} className="col-span-3 inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-red-200 bg-white text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-400/20 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-400/10"><Trash2 size={14} />Eliminar</button>}
              </div>
              <button type="button" onClick={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1 rounded-xl border border-stone-200 text-[11px] font-bold text-stone-600 hover:border-violet-300 hover:text-violet-700 dark:border-violet-400/15 dark:text-[#aaa4c4] dark:hover:text-violet-300">
                {expanded[item.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}Ver {expanded[item.id] ? 'menos' : 'más'}
              </button>
              {expanded[item.id] && <dl className="mt-3 max-h-72 overflow-auto rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-[11px] dark:border-violet-400/15 dark:bg-white/[0.025]">
                {metadataEntries.length ? metadataEntries.map(([key, value]) => <div key={key} className="border-b border-stone-200 py-2 last:border-b-0 dark:border-violet-400/10"><dt className="mb-1 font-bold text-stone-500 dark:text-[#8f89ad]">{key}</dt><dd className="whitespace-pre-wrap break-words font-mono text-stone-800 dark:text-[#ddd8f5]">{formatMetadataValue(value)}</dd></div>) : <div className="text-stone-400">Sin metadatos disponibles</div>}
              </dl>}
            </div>
          </article>;
        })}</div>}

      {!loading && (images.length > 0 || page > 1) && <nav className="mt-7 flex items-center justify-between rounded-2xl border border-black/[0.05] bg-white/70 px-3 py-2 dark:border-violet-400/10 dark:bg-white/[0.02]"><button disabled={!!busy || page === 1} onClick={() => setPage((current) => current - 1)} className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-35"><ChevronLeft size={15} />Anterior</button><span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Página {page}</span><button disabled={!!busy || !hasMore} onClick={() => setPage((current) => current + 1)} className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-35">Siguiente<ChevronRight size={15} /></button></nav>}
    </div>
  </div>;
}
