import Link from 'next/link';
import { Search, UserPlus, LogIn } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-[600px] mx-auto px-4 flex items-center justify-between h-full">
        <Link href="/" className="font-bold text-lg">
          <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Quemones
          </span>
          <span className="text-gray-900">UM</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/buscar"
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Buscar"
          >
            <Search size={18} strokeWidth={1.5} />
          </Link>
          <Link
            href="/login"
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Iniciar sesión"
          >
            <LogIn size={18} strokeWidth={1.5} />
          </Link>
          <Link
            href="/registro"
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Registrarse"
          >
            <UserPlus size={18} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
