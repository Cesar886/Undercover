'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, EyeOff, Flag, MessageSquare, RefreshCw, X } from 'lucide-react';

type Status = 'all' | 'pending' | 'reviewed' | 'dismissed';
type Sort = 'count' | 'recent';

interface ReportGroup {
  target_type: 'post' | 'comment';
  target_id: string;
  post_id: string | null;
  reason: string;
  detail: string | null;
  content: string;
  image_webp: string | null;
  report_count: number;
  first_reported_at: string;
  latest_reported_at: string;
  review_status: Exclude<Status, 'all'>;
  reviewed_at: string | null;
  is_hidden: boolean;
  is_deleted: boolean;
  parent_hidden: boolean | null;
}

type Counts = Record<Status, number>;

const FILTERS: { value: Status; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'reviewed', label: 'Revisados' },
  { value: 'dismissed', label: 'Descartados' },
  { value: 'all', label: 'Todos' },
];

const STATUS_META: Record<Exclude<Status, 'all'>, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' },
  reviewed: { label: 'Revisado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' },
  dismissed: { label: 'Descartado', className: 'bg-stone-200 text-stone-700 dark:bg-white/10 dark:text-stone-300' },
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function textPreview(value: string) {
  const clean = value.trim();
  return clean.length > 150 ? clean.slice(0, 150) + '...' : clean || 'Sin texto disponible';
}

function targetHref(report: ReportGroup) {
  if (report.target_type === 'post') return `/posts/${report.target_id}`;
  return report.post_id ? `/posts/${report.post_id}#comment-${report.target_id}` : '#';
}

export function AdminReportsPanel() {
  const [reports, setReports] = useState<ReportGroup[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, pending: 0, reviewed: 0, dismissed: 0 });
  const [status, setStatus] = useState<Status>('pending');
  const [sort, setSort] = useState<Sort>('count');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmHide, setConfirmHide] = useState<ReportGroup | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), status, sort });
      const res = await fetch('/api/image-admin/reports?' + params.toString(), { cache: 'no-store' });
      if (res.status === 401) {
        window.location.replace('/imagenes-dnewjlfe99474ef8wu-admin/login');
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json() as { reports: ReportGroup[]; counts: Counts; hasMore: boolean };
      setReports(data.reports);
      setCounts(data.counts);
      setHasMore(data.hasMore);
      if (!data.reports.length && page > 1) setPage((current) => current - 1);
    } catch {
      setError('No se pudieron cargar los reportes.');
    } finally {
      setLoading(false);
    }
  }, [page, sort, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function changeStatus(next: Status) {
    setStatus(next);
    setPage(1);
  }

  async function updateReport(report: ReportGroup, action: 'reviewed' | 'dismissed') {
    const key = report.target_type + ':' + report.target_id;
    setBusy(key);
    setError('');
    try {
      const res = await fetch('/api/image-admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: report.target_type, target_id: report.target_id, action }),
      });
      if (res.status === 401) {
        window.location.replace('/imagenes-dnewjlfe99474ef8wu-admin/login');
        return;
      }
      if (!res.ok) throw new Error();
      setNotice(action === 'reviewed' ? 'Reporte marcado como revisado.' : 'Reporte descartado.');
      await load();
    } catch {
      setError('No se pudo guardar la accion.');
    } finally {
      setBusy(null);
    }
  }

  async function hideContent() {
    if (!confirmHide) return;
    const report = confirmHide;
    const key = report.target_type + ':' + report.target_id;
    setBusy(key);
    setError('');
    try {
      const res = await fetch('/api/image-admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: report.target_type, target_id: report.target_id }),
      });
      if (res.status === 401) {
        window.location.replace('/imagenes-dnewjlfe99474ef8wu-admin/login');
        return;
      }
      if (!res.ok) throw new Error();
      setConfirmHide(null);
      setNotice('Contenido ocultado y reporte marcado como revisado.');
      await load();
    } catch {
      setError('No se pudo ocultar el contenido.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-8 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-[0_16px_50px_rgba(60,42,86,0.08)] dark:border-violet-400/15 dark:bg-[#0b0916]">
      <div className="flex flex-col gap-4 border-b border-black/[0.05] px-5 py-5 dark:border-violet-400/10 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-300"><Flag size={22} /></span>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-mauve-600 dark:text-violet-400">Apoyo admin</p>
            <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-[#f0edff]">Reportes</h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-[#777294]">Agrupados por contenido reportado, sin datos del reportante.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-violet-400/15 dark:bg-white/[0.025]">
            <button onClick={() => setSort('count')} className={`h-8 rounded-lg px-3 text-xs font-semibold ${sort === 'count' ? 'bg-violet-600 text-white' : 'text-stone-500 dark:text-[#a7a1c2]'}`}>Mas reportados</button>
            <button onClick={() => setSort('recent')} className={`h-8 rounded-lg px-3 text-xs font-semibold ${sort === 'recent' ? 'bg-violet-600 text-white' : 'text-stone-500 dark:text-[#a7a1c2]'}`}>Mas recientes</button>
          </div>
          <button onClick={() => void load()} disabled={loading || !!busy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 px-3.5 text-xs font-semibold text-stone-600 disabled:opacity-50 dark:border-violet-400/15 dark:text-[#a7a1c2]">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Actualizar
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-black/[0.05] px-5 py-3 dark:border-violet-400/10 sm:px-7">
        {FILTERS.map((option) => (
          <button key={option.value} onClick={() => changeStatus(option.value)} className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${status === option.value ? 'border-violet-600 bg-violet-600 text-white' : 'border-stone-200 bg-white text-stone-500 hover:border-violet-300 dark:border-violet-400/15 dark:bg-white/[0.025] dark:text-[#777294]'}`}>
            {option.label}<span className={`ml-1.5 ${status === option.value ? 'text-white/70' : 'text-stone-400'}`}>{counts[option.value]}</span>
          </button>
        ))}
      </div>

      {error && <div role="alert" className="mx-5 mt-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/15 dark:bg-red-400/[0.08] dark:text-red-300 sm:mx-7"><AlertCircle size={17} />{error}</div>}
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-700 shadow-xl dark:border-emerald-400/20 dark:bg-[#151125] dark:text-emerald-300"><Check size={15} />{notice}</div>}

      {loading ? (
        <div className="space-y-3 p-5 sm:p-7">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-stone-100 dark:bg-violet-500/10" />)}</div>
      ) : reports.length === 0 ? (
        <div className="px-5 py-10 text-center sm:px-7">
          <MessageSquare size={28} className="mx-auto mb-3 text-stone-300 dark:text-violet-900/60" />
          <p className="text-sm text-stone-500 dark:text-[#777294]">No hay reportes en este filtro.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 dark:divide-violet-400/10">
          {reports.map((report) => {
            const key = report.target_type + ':' + report.target_id;
            const meta = STATUS_META[report.review_status];
            const hidden = report.is_hidden || report.is_deleted || Boolean(report.parent_hidden);
            return (
              <article key={key} className="px-5 py-4 sm:px-7">
                <div className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100 dark:bg-white/[0.04]">
                    {report.image_webp ? <img src={report.image_webp} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-stone-300"><Flag size={18} /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${meta.className}`}>{meta.label}</span>
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">{report.target_type === 'post' ? 'Publicacion' : 'Comentario'}</span>
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300">{report.report_count} reporte{report.report_count !== 1 ? 's' : ''}</span>
                          {hidden && <span className="rounded-full bg-stone-200 px-2.5 py-1 text-[10px] font-bold text-stone-600 dark:bg-white/10 dark:text-stone-300">Oculto</span>}
                        </div>
                        <p className="line-clamp-3 text-sm text-stone-700 dark:text-[#d4ceff]">{textPreview(report.content)}</p>
                        <p className="mt-2 text-[11px] text-stone-400">Motivo: {report.reason} · Ultimo reporte {dateLabel(report.latest_reported_at)}</p>
                        {report.detail && <p className="mt-1 line-clamp-2 text-xs italic text-stone-500 dark:text-[#aaa4c4]">{report.detail}</p>}
                      </div>
                      <a href={targetHref(report)} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 px-3 text-xs font-semibold text-stone-600 hover:border-violet-300 dark:border-violet-400/15 dark:text-[#a7a1c2]">
                        Abrir
                      </a>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {report.review_status !== 'reviewed' && <button disabled={!!busy} onClick={() => updateReport(report, 'reviewed')} className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[11px] font-bold text-white disabled:opacity-40"><Check size={14} />Marcar revisado</button>}
                      {report.review_status !== 'dismissed' && <button disabled={!!busy} onClick={() => updateReport(report, 'dismissed')} className="inline-flex h-9 items-center gap-1 rounded-xl bg-stone-100 px-3 text-[11px] font-bold text-stone-600 disabled:opacity-40 dark:bg-white/10 dark:text-stone-300"><X size={14} />Descartar</button>}
                      {!hidden && <button disabled={!!busy} onClick={() => setConfirmHide(report)} className="inline-flex h-9 items-center gap-1 rounded-xl bg-red-50 px-3 text-[11px] font-bold text-red-700 disabled:opacity-40 dark:bg-red-400/10 dark:text-red-300"><EyeOff size={14} />Ocultar contenido</button>}
                      {busy === key && <span className="inline-flex h-9 items-center px-3 text-xs text-stone-400">Procesando...</span>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && (reports.length > 0 || page > 1) && <nav className="flex items-center justify-between border-t border-black/[0.05] px-5 py-3 dark:border-violet-400/10 sm:px-7"><button disabled={!!busy || page === 1} onClick={() => setPage((current) => current - 1)} className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-35"><ChevronLeft size={15} />Anterior</button><span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Pagina {page}</span><button disabled={!!busy || !hasMore} onClick={() => setPage((current) => current + 1)} className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-35">Siguiente<ChevronRight size={15} /></button></nav>}

      {confirmHide && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-[#151125]"><h3 className="text-base font-semibold text-stone-900 dark:text-[#f0edff]">Ocultar contenido</h3><p className="mt-2 text-sm text-stone-500 dark:text-[#aaa4c4]">Esto reutiliza el mecanismo existente de ocultar marcando el contenido como no visible. No borra reportes ni contenido.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmHide(null)} className="h-9 rounded-xl px-3 text-xs font-semibold text-stone-500">Cancelar</button><button onClick={hideContent} disabled={!!busy} className="h-9 rounded-xl bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-40">Ocultar</button></div></div></div>}
    </section>
  );
}
