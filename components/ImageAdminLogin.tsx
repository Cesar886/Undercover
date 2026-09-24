'use client';
import { useState } from 'react';
const ADMIN = '/imagenes-dnewjlfe99474ef8wu-admin';
export function ImageAdminLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/image-admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
      if (res.ok) { window.location.replace(ADMIN); return; }
      setError((await res.json()).error);
    } catch { setError('No se pudo conectar. Intenta nuevamente.'); }
    finally { setBusy(false); }
  }
  return <main className="max-w-sm mx-auto px-4 py-12">
    <h1 className="text-xl font-bold mb-6">Administración de imágenes</h1>
    <form onSubmit={login} className="space-y-4">
      <label className="block">Usuario<input name="username" autoComplete="username" required className="block w-full border rounded p-2 text-black" /></label>
      <label className="block">Contraseña<input name="password" type="password" autoComplete="current-password" required className="block w-full border rounded p-2 text-black" /></label>
      <button disabled={busy} className="bg-violet-700 text-white rounded px-4 py-2 disabled:opacity-50">{busy ? 'Entrando…' : 'Entrar'}</button>
      {error && <p role="alert" className="text-red-500">{error}</p>}
    </form>
  </main>;
}
