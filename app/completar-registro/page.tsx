'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function CompletarRegistroPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect to login if no pending_google cookie (accessed directly)
  useEffect(() => {
    fetch('/api/auth/me').then(async (res) => {
      const data = await res.json();
      // If already logged in, go home
      if (data.user) router.replace('/');
    });
  }, [router]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (username.trim().length === 0) { setStatus('idle'); return; }

    setStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username.trim())}`);
        const data = await res.json();
        setStatus(data.available ? 'available' : 'taken');
      } catch {
        setStatus('idle');
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== 'available') return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        setError(data.error ?? 'Error al crear la cuenta');
        return;
      }
      router.push('/?registered=true');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">

          <div className="px-8 pt-8 pb-4 text-center">
            <p className="text-3xl mb-3">👤</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Elige tu alias</h1>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">
              Este nombre será público en tus posts. No uses tu nombre real.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 pt-4 flex flex-col gap-4">
            <div>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                  placeholder="alias_sin_espacios"
                  maxLength={30}
                  required
                  autoFocus
                  className={`w-full border rounded-xl px-3 py-2.5 pr-9 text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-300 dark:placeholder-zinc-500 focus:outline-none transition-colors ${
                    status === 'available' ? 'border-green-400 focus:border-green-500' :
                    status === 'taken'     ? 'border-red-400 focus:border-red-500' :
                    'border-gray-200 dark:border-zinc-700 focus:border-mauve-500'
                  }`}
                />
                {status === 'checking' && (
                  <span className="absolute right-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-mauve-500 rounded-full animate-spin" />
                )}
                {status === 'available' && (
                  <span className="absolute right-3 top-1/2 -tranzinc-y-1/2 text-green-500">✓</span>
                )}
                {status === 'taken' && (
                  <span className="absolute right-3 top-1/2 -tranzinc-y-1/2 text-red-500">✗</span>
                )}
              </div>

              <p className={`text-[11px] mt-1 ${
                status === 'available' ? 'text-green-500' :
                status === 'taken'     ? 'text-red-500' :
                'text-mauve-500/80'
              }`}>
                {status === 'available' && '¡Alias disponible!'}
                {status === 'taken'     && 'Ese alias ya está en uso, elige otro.'}
                {(status === 'idle' || status === 'checking') && 'Sin espacios — este alias será visible en tus posts.'}
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || status !== 'available'}
              className="w-full bg-mauve-600 hover:bg-mauve-700 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {loading ? 'Creando cuenta...' : 'Entrar a QuemonesUM'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
