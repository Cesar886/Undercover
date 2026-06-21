'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Sun, Moon, Archive } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { BOARDS } from '@/lib/boards';

export function Navbar() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#06050f]/90 backdrop-blur-md border-b border-black/[0.04] dark:border-violet-500/10 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_0_rgba(124,58,237,0.08)]">
      {/* Main bar */}
      <div className="max-w-[600px] mx-auto px-4 flex items-center justify-between h-12">
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

      {/* Board tabs */}
      <div className="max-w-[600px] mx-auto px-3 h-9 flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {BOARDS.map((board) => {
          const active = pathname === `/${board.slug}`;
          return (
            <Link
              key={board.slug}
              href={`/${board.slug}`}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold transition-all duration-200 select-none ${
                active
                  ? ''
                  : 'border-transparent text-gray-400 dark:text-[#4a4870] hover:text-gray-600 dark:hover:text-violet-300 hover:border-gray-200 dark:hover:border-violet-500/20 hover:bg-gray-50 dark:hover:bg-violet-500/8'
              }`}
              style={active ? {
                backgroundColor: board.bg,
                borderColor: board.border,
                color: board.text,
                boxShadow: board.glow,
              } : {}}
              aria-current={active ? 'page' : undefined}
            >
              {board.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
