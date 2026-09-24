'use client';
import { FormEvent, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { apiPost } from '@/lib/apiClient';
import type { Category } from '@/lib/categories';

export function CreateCategory({ onCreated }: { onCreated: (category: Category) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    const result = await apiPost<{ category: Category }>('/api/categories', { name, description });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.data.category);
    window.dispatchEvent(new Event('categories:changed'));
    setName('');
    setDescription('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50 dark:border-violet-500/30 dark:text-violet-300 dark:hover:bg-violet-500/10"
      >
        <Plus size={14} /> Crear categoría
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-500/20 dark:bg-[#0d0b1a]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-[#e9e5ff]">Nueva categoría</h2>
          <p className="text-xs text-gray-400">Será visible para toda la comunidad.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="p-1 text-gray-400 hover:text-gray-700">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 40))}
          placeholder="Nombre de la categoría"
          minLength={3}
          maxLength={40}
          required
          className="w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-violet-500/20"
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, 120))}
          placeholder="Descripción breve (opcional)"
          maxLength={120}
          className="w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-violet-500/20"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Máximo 3 nuevas por día</span>
        <button
          type="submit"
          disabled={saving || name.trim().length < 3}
          className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Creando…' : 'Crear categoría'}
        </button>
      </div>
    </form>
  );
}
