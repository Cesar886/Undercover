'use client';
import Link from 'next/link';
import { Search, Sun, Moon, Archive } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export function Navbar() {
  const { theme, toggle } = useTheme();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 bg-white/80 dark:bg-[#06050f]/90 backdrop-blur-md border-b border-black/[0.04] dark:border-violet-500/10 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_0_rgba(124,58,237,0.08)]">
      <div className="max-w-[600px] mx-auto px-4 flex items-center justify-between h-full">
        <Link href="/" className="font-bold text-lg">
          <span className="bg-gradient-to-r from-mauve-400 to-mauve-800 dark:from-violet-400 dark:to-violet-700 bg-clip-text text-transparent">
            Deep
          </span>
          <span className="text-gray-900 dark:text-[#e9e5ff]">UM</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/buscar"
            className="text-gray-400 dark:text-[#4a4870] hover:text-gray-700 dark:hover:text-violet-300 transition-colors p-1"
            aria-label="Buscar"
          >
            <Search size={18} strokeWidth={1.5} />
          </Link>

          <Link
            href="/archivo"
            className="text-gray-400 dark:text-[#4a4870] hover:text-gray-700 dark:hover:text-violet-300 transition-colors p-1"
            aria-label="Archivo"
            title="Archivo"
          >
            <Archive size={18} strokeWidth={1.5} />
          </Link>

          <button
            onClick={toggle}
            className="text-gray-400 dark:text-[#4a4870] hover:text-gray-700 dark:hover:text-violet-300 transition-colors p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-violet-500/10"
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark'
              ? <Sun size={16} strokeWidth={1.5} />
              : <Moon size={16} strokeWidth={1.5} />
            }
          </button>
        </div>
      </div>
    </nav>
  );
}
