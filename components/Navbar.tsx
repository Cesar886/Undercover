'use client';
import Link from 'next/link';
import { Search, Sun, Moon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

export function Navbar() {
  const [username, setUsername] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const controller = new AbortController();
    setAuthLoading(true);
    fetch('/api/auth/me', { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setUsername(data.user?.username ?? null))
      .catch((err) => { if (err.name !== 'AbortError') setUsername(null); })
      .finally(() => setAuthLoading(false));
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleLogout() {
    setLogoutError(false);
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (!res.ok) { setLogoutError(true); return; }
    setUsername(null);
    setOpen(false);
    router.push('/');
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 bg-white/80 dark:bg-[#030303]/80 backdrop-blur-md border-b border-black/[0.04] dark:border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-none">
      <div className="max-w-[600px] mx-auto px-4 flex items-center justify-between h-full">
        <Link href="/" className="font-bold text-lg">
          <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Quemones
          </span>
          <span className="text-gray-900 dark:text-zinc-100">UM</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/buscar"
            className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors p-1"
            aria-label="Buscar"
          >
            <Search size={18} strokeWidth={1.5} />
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark'
              ? <Sun size={16} strokeWidth={1.5} />
              : <Moon size={16} strokeWidth={1.5} />
            }
          </button>

          {authLoading ? (
            <div className="w-20 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 animate-pulse" />
          ) : username ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold uppercase hover:bg-orange-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                aria-label="Menú de usuario"
                aria-expanded={open}
              >
                {username[0]}
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg py-1 text-sm">
                  <div className="px-3 py-2 text-gray-400 dark:text-zinc-500 text-xs font-medium truncate border-b border-gray-100 dark:border-zinc-800">
                    @{username}
                  </div>
                  {logoutError && (
                    <p className="px-3 py-1.5 text-xs text-red-500">
                      Error al cerrar sesión
                    </p>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-100 transition-colors px-2 py-1"
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4 py-1.5 transition-colors"
              >
                Regístrate
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
