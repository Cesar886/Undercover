'use client';
import { useEffect, useState } from 'react';
import { ReportReason } from '@/types';

interface ReportDialogProps {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (reason: ReportReason, detail?: string) => Promise<void> | void;
}

const REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'spam',           label: 'Spam',                    description: 'Promociones repetidas o irrelevantes.' },
  { value: 'inappropriate',  label: 'Contenido inapropiado',   description: 'Sexual, gráfico o NSFW.' },
  { value: 'harassment',     label: 'Acoso',                   description: 'Insultos directos o amenazas.' },
  { value: 'misinformation', label: 'Información falsa',       description: 'Datos engañosos o inventados.' },
  { value: 'other',          label: 'Otro',                    description: 'Cuéntanos brevemente la razón.' },
];

export function ReportDialog({ open, busy = false, onCancel, onSubmit }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (!open) {
      setReason(null);
      setDetail('');
      return;
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel, busy]);

  if (!open) return null;

  const detailRequired = reason === 'other';
  const canSubmit = !!reason && !busy;

  function submit() {
    if (!reason) return;
    if (detailRequired) {
      onSubmit(reason, detail.trim() || undefined);
    } else {
      onSubmit(reason);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 animate-fade-in"
      onClick={() => { if (!busy) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-5 animate-fade-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-title" className="text-base font-semibold text-stone-900 dark:text-slate-100 mb-1">
          Reportar
        </h2>
        <p className="text-[13px] text-stone-500 dark:text-slate-400 mb-4">
          Selecciona el motivo. Lo revisará el equipo de moderación.
        </p>

        <div className="space-y-1.5">
          {REASONS.map((r) => {
            const active = reason === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                  active
                    ? 'border-orange-400 bg-orange-50/60 dark:bg-orange-500/10'
                    : 'border-stone-200 dark:border-slate-700 hover:border-stone-300 dark:hover:border-slate-600 hover:bg-stone-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${
                    active ? 'border-orange-500 bg-orange-500' : 'border-stone-300'
                  }`} />
                  <span className="text-[13px] font-medium text-stone-800 dark:text-slate-200">{r.label}</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5 ml-5.5 pl-[22px]">{r.description}</p>
              </button>
            );
          })}
        </div>

        {detailRequired && (
          <div className="mt-3">
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 200))}
              placeholder="Cuéntanos brevemente (opcional)"
              rows={2}
              className="w-full text-[13px] text-stone-800 dark:text-slate-200 placeholder-stone-300 dark:placeholder-slate-600 bg-transparent dark:bg-slate-800 resize-none border border-stone-200 dark:border-slate-700 focus:border-orange-400 rounded-lg px-3 py-2 focus:outline-none"
            />
            <p className="text-[10px] text-stone-400 text-right mt-0.5">{200 - detail.length}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-1.5 text-sm text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="px-4 py-1.5 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 active:scale-95 rounded-full transition-all shadow-sm disabled:opacity-40"
          >
            {busy ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </div>
      </div>
    </div>
  );
}
