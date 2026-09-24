'use client';
import { useCallback, useEffect, useState } from 'react';
const ADMIN = '/imagenes-dnewjlfe99474ef8wu-admin';
interface Review { id: string; created_at: string; kind: string; content: string; }
export function ImageReviewQueue() {
  const [images, setImages] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/image-admin?page=' + page, { cache: 'no-store' });
      if (res.status === 401) { window.location.replace(ADMIN + '/login'); return; }
      if (!res.ok) throw new Error('No se pudo cargar la cola.');
      const data = await res.json();
      setImages(data.images); setHasMore(data.hasMore);
      if (!data.images.length && page > 1) setPage(page - 1);
    } catch { setError('No se pudo cargar la cola. Intenta actualizar.'); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { void load(); }, [load]);
  async function review(id: string, decision: 'approved' | 'rejected') {
    setBusy(id); setError('');
    try {
      const res = await fetch('/api/image-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decision }) });
      if (res.status === 401) { window.location.replace(ADMIN + '/login'); return; }
      if (!res.ok) { setError((await res.json()).error); return; }
      await load();
    } catch { setError('No se pudo guardar la decisión. Intenta nuevamente.'); }
    finally { setBusy(null); }
  }
  async function logout() {
    try {
      const res = await fetch('/api/image-admin/session', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      window.location.replace(ADMIN + '/login');
    } catch { setError('No se pudo cerrar la sesión. Intenta nuevamente.'); }
  }
  return <main className="max-w-5xl mx-auto px-4 py-8">
    <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
      <h1 className="text-2xl font-bold">Imágenes pendientes de revisión</h1>
      <div className="flex gap-4"><button onClick={() => void load()} disabled={loading || !!busy}>Actualizar</button><button onClick={logout}>Cerrar sesión</button></div>
    </div>
    {error && <p role="alert" className="text-red-500 mb-4">{error}</p>}
    {loading ? <p role="status">Cargando…</p> : images.length === 0 ? <p>No hay imágenes pendientes.</p> :
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{images.map((item) =>
        <article key={item.id} className="border rounded-xl p-4 space-y-3">
          {/* Native img keeps private previews out of Next's public image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={'/api/image-admin/' + item.id} alt="Imagen pendiente de revisión" loading="lazy" className="w-full h-64 object-contain bg-gray-100 rounded" />
          <p className="text-xs">{item.kind} · {new Date(item.created_at).toLocaleString('es-MX')}</p>
          {item.content && <p className="text-sm break-words">{item.content}</p>}
          <div className="flex gap-2">
            <button disabled={!!busy} onClick={() => review(item.id, 'approved')} className="bg-green-700 text-white rounded px-4 py-2 disabled:opacity-50">Aceptar</button>
            <button disabled={!!busy} onClick={() => review(item.id, 'rejected')} className="bg-red-700 text-white rounded px-4 py-2 disabled:opacity-50">Rechazar</button>
          </div>
        </article>)}</div>}
    <div className="flex gap-4 mt-6">
      <button disabled={loading || !!busy || page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
      <span>Página {page}</span>
      <button disabled={loading || !!busy || !hasMore} onClick={() => setPage(page + 1)}>Siguiente</button>
    </div>
  </main>;
}
