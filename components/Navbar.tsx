import Link from 'next/link';
import { Search, Bookmark } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 bg-white/90 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-[600px] mx-auto px-4 flex items-center justify-between h-full">
        <Link href="/" className="font-bold text-lg">
          <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Quemados
          </span>
          <span className="text-gray-900">UM</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/buscar"
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Buscar"
          >
            <Search size={18} />
          </Link>
          <Link
            href="/guardados"
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Guardados"
          >
            <Bookmark size={18} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
