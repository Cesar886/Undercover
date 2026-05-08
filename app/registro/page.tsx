'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegistroPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (username.trim().length === 0) { setUsernameStatus('idle'); return; }

    setUsernameStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username.trim())}`);
        const data = await res.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al registrarse');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/'), 1500);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="max-w-[600px] mx-auto px-4 py-6">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
          <p className="text-3xl mb-3">🔥</p>
          <p className="font-semibold text-gray-900">¡Registro exitoso!</p>
          <p className="text-sm text-gray-400 mt-1">Redirigiendo...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <h1 className="text-lg font-bold text-gray-900">Crear cuenta</h1>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Alias anónimo
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="No uses tu nombre real"
                maxLength={30}
                required
                className={`w-full border rounded-xl px-3 py-2.5 pr-9 text-sm text-gray-900 placeholder-gray-300 focus:outline-none transition-colors ${
                  usernameStatus === 'available' ? 'border-green-400 focus:border-green-500' :
                  usernameStatus === 'taken'     ? 'border-red-400 focus:border-red-500' :
                  'border-gray-200 focus:border-orange-400'
                }`}
              />
              {usernameStatus === 'checking' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-orange-400 rounded-full animate-spin" />
              )}
              {usernameStatus === 'available' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-base">✓</span>
              )}
              {usernameStatus === 'taken' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-base">✗</span>
              )}
            </div>
            {usernameStatus === 'available' && (
              <p className="text-[11px] text-green-500 mt-1">¡Alias disponible!</p>
            )}
            {usernameStatus === 'taken' && (
              <p className="text-[11px] text-red-500 mt-1">Ese alias ya está en uso, elige otro.</p>
            )}
            {(usernameStatus === 'idle' || usernameStatus === 'checking') && (
              <p className="text-[11px] text-orange-400/80 mt-1">Sin espacios — este alias será público en tus posts.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-orange-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-orange-400 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-xs text-gray-400">
            ¿Ya tienes cuenta?{' '}
            <Link href="/" className="text-orange-500 hover:underline">
              Volver al inicio
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
